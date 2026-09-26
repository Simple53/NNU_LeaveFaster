// Run: node test-pagination.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/nnu_leave_enhancer.user.js`, 'utf8');
// Flow diagram pages must exit before touching window, DOM, storage or network APIs.
vm.runInNewContext(source, { location: { href: 'https://example.test/flowDiagram.html' } });
const requests = [];
class XHR {
    open(method, url) { this.url = url; }
    send(body) { requests.push({ url: this.url, body }); }
    addEventListener() {}
}
const window = { XMLHttpRequest: XHR, FormData, URLSearchParams };
window.self = window.top = window;
const context = vm.createContext({
    window, location: { href: '' }, console, setTimeout() {},
    localStorage: { getItem: () => null },
    document: { getElementById: () => null },
});
vm.runInContext(source.replace('    init();', `
    globalThis.test = { rewritePageParams, triggerReloadData, summarizePageResponse, getMainTables };
    currentCustomPageSize = 50;
    showToast = message => { globalThis.lastToast = message; };
`), context);
const { rewritePageParams, triggerReloadData, summarizePageResponse } = context.test;
for (const key of ['pageSize', 'pagesize', '*pageSize', '%2ApageSize', 'rows', 'limit']) {
    assert.equal(rewritePageParams(`${key}=10&pageNumber=3`), `${key}=50&pageNumber=3`);
}
assert.equal(rewritePageParams('{"*pageSize":"10","pageNumber":3}'), '{"*pageSize":"50","pageNumber":3}');
const encoded = new URLSearchParams({ data: '{"pageSize":10,"filter":"a&b"}' }).toString();
assert.deepEqual(JSON.parse(new URLSearchParams(rewritePageParams(encoded)).get('data')), { pageSize: 50, filter: 'a&b' });
for (const Body of [FormData, URLSearchParams]) {
    const body = new Body();
    body.set('*pageSize', '10');
    body.set('pageNumber', '2');
    assert.equal(rewritePageParams(body).get('*pageSize'), '50');
    assert.equal(body.get('pageNumber'), '2');
}
assert.equal(rewritePageParams('filter=%ZZ&status=pending'), 'filter=%ZZ&status=pending');
for (const action of ['queryUserTasks.do', 'getList.do', 'review.do']) {
    const xhr = new XHR();
    xhr.open('POST', `/${action}?pageSize=10`);
    xhr.send('*pageSize=10');
}
assert.deepEqual(requests, [
    { url: '/queryUserTasks.do?pageSize=50', body: '*pageSize=50' },
    { url: '/getList.do?pageSize=10', body: '*pageSize=10' },
    { url: '/review.do?pageSize=10', body: '*pageSize=10' },
]);
assert.equal(JSON.stringify(summarizePageResponse({ data: { rows: [{ name: 'private' }], totalSize: 100 } })), '{"data":{"rows":{"count":1},"totalSize":100}}');

// Realistic widget contract: changing page size/page loads data; repeating it does not.
for (const kind of ['jqxGrid', 'jqxDataTable']) {
    for (const initialPage of [0, 3]) {
        let size = 10, page = initialPage, loads = 0;
        const table = {
            data: key => key === kind ? {} : undefined,
            [kind](arg, value) {
                if (typeof arg === 'object') {
                    const next = arg[kind === 'jqxGrid' ? 'pagesize' : 'pageSize'];
                    if (size !== next) { size = next; loads++; }
                } else if (arg === 'pagesize' || arg === 'pageSize') return size;
                else if (arg === 'getpaginginformation') return { pagenum: page, pagesize: size };
                else if (arg === 'gotopage' || arg === 'goToPage') { if (page !== value) loads++; page = value; }
                else if (arg === 'updatebounddata' || arg === 'updateBoundData') loads++;
                else throw Error(`Unexpected API: ${arg}`);
            },
        };
        const main = { getClientRects: () => [1], closest: () => null };
        const dialog = { getClientRects: () => [1], closest: () => ({}) };
        context.document.querySelectorAll = () => [dialog, main];
        window.jQuery = el => { assert.equal(el, main); return table; };
        triggerReloadData();
        assert.equal(size, 50);
        assert.equal(page, 0);
        assert.ok(loads > 0);
        const before = loads;
        triggerReloadData();
        assert.equal(loads, before + 1, 'same-size Refresh must load again');
    }
}
context.document.querySelectorAll = () => [];
triggerReloadData();
assert.match(context.lastToast, /未找到/);
console.log('Pagination regression checks passed.');
