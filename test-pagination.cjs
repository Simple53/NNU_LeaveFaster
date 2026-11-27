// Run: node test-pagination.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/nnu_leave_enhancer.user.js`, 'utf8');
// Unslop check: ensure zero emojis in injected UI/copy
assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(source), false, 'Script must not contain emoji characters');

// Flow diagram pages must exit before touching window, DOM, storage or network APIs.
vm.runInNewContext(source, { location: { href: 'https://example.test/flowDiagram.html' } });
const requests = [];
class XHR {
    open(method, url) { this.url = url; }
    send(body) { requests.push({ url: this.url, body }); }
    addEventListener() {}
}
const origEmapdatatable = Object.assign(function emapdatatable() {}, { defaults: { pageSize: 10 } });
const window = { XMLHttpRequest: XHR, FormData, URLSearchParams };
window.self = window.top = window;
const context = vm.createContext({
    window, location: { href: '', origin: 'https://ehallapp.nnu.edu.cn' }, console, setTimeout() {},
    localStorage: { getItem: () => null },
    document: { getElementById: () => null },
});
vm.runInContext(source.replace('    init();', `
    globalThis.test = {
        rewritePageParams, triggerReloadData, summarizePageResponse, getMainTables,
        extractAttachmentsFromPayload, fillAgreeOpinion, submitReviewForm, toggleSelectAll,
        unlockGridSelectionLimits
    };
    currentCustomPageSize = 50;
    showToast = message => { globalThis.lastToast = message; };
`), context);
const {
    rewritePageParams, triggerReloadData, summarizePageResponse,
    extractAttachmentsFromPayload, fillAgreeOpinion, submitReviewForm, toggleSelectAll,
    unlockGridSelectionLimits
} = context.test;

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
assert.equal(rewritePageParams('status=pending&userId=12345'), 'status=pending&userId=12345');
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

// Regression check: unlockGridSelectionLimits must NOT wrap $.fn.emapdatatable or break its defaults
const tipCalls = [];
const mockJq = {
    fn: { emapdatatable: origEmapdatatable },
    bhTip: Object.assign(msg => tipCalls.push(msg), { version: '1.0' }),
};
window.jQuery = Object.assign(() => ({}), mockJq);
unlockGridSelectionLimits();
assert.equal(window.jQuery.fn.emapdatatable, origEmapdatatable, 'emapdatatable must remain untouched');
assert.equal(window.jQuery.bhTip.version, '1.0', 'bhTip static properties must be preserved');
window.jQuery.bhTip('批量处理不能超过10条');
window.jQuery.bhTip('操作成功');
assert.deepEqual(tipCalls, ['操作成功']);

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

// Attachment extraction unit tests
const sampleAttachmentPayload = {
    datas: {
        rows: [
            { fileName: '病假条.jpg', fileUrl: '/qljfw/file/101.jpg' },
            { fileName: '病假条.jpg', fileUrl: '/qljfw/file/101.jpg' },
            { fileName: '医院证明.png', fileToken: 'tok-999' },
            { fileName: 'xss.jpg', url: 'javascript:alert(1)' },
            { fileName: 'notes.txt', url: '/qljfw/file/notes.txt' },
        ]
    }
};
const extracted = extractAttachmentsFromPayload(sampleAttachmentPayload, 'https://ehallapp.nnu.edu.cn');
assert.deepEqual(JSON.parse(JSON.stringify(extracted)), [
    { name: '病假条.jpg', url: 'https://ehallapp.nnu.edu.cn/qljfw/file/101.jpg' },
    { name: '医院证明.png', url: 'https://ehallapp.nnu.edu.cn/qljfw/sys/emapcomponent/file/getAttachmentFile/tok-999.do' },
]);

// Mobile one-tap approve & submit helper tests
let radioClicked = false, btnClicked = false;
const eventsDispatched = [];
const mockDoc = {
    querySelectorAll(sel) {
        if (sel === 'input[type="radio"]') {
            return [{ parentElement: { textContent: '同意' }, click() { radioClicked = true; } }];
        }
        if (sel === 'textarea') {
            return [{ offsetParent: {}, value: '', dispatchEvent(ev) { eventsDispatched.push(ev.type); } }];
        }
        if (sel.includes('button')) {
            return [
                { textContent: '同意并提交', offsetParent: {}, closest: () => ({}), click() { throw Error('must skip quick bar button'); } },
                { textContent: '确定', offsetParent: {}, disabled: false, closest: () => null, click() { btnClicked = true; } },
            ];
        }
        return [];
    }
};
context.Event = class Event { constructor(type) { this.type = type; } };
assert.equal(fillAgreeOpinion(mockDoc), true);
assert.equal(radioClicked, true);
assert.deepEqual(eventsDispatched, ['input', 'change']);
assert.equal(submitReviewForm(mockDoc), true);
assert.equal(btnClicked, true);

// Batch selectAll uses beginupdate/endupdate fallback safely when DOM checkboxes are absent
const calls = [];
const mainEl = { getClientRects: () => [1], closest: () => null };
context.document.querySelectorAll = sel => (!sel.includes('checkbox') && sel.includes('emapdatatable') ? [mainEl] : []);
window.jQuery = () => ({
    data: k => (k === 'jqxGrid' ? {} : undefined),
    jqxGrid(cmd) { calls.push(cmd); },
});
toggleSelectAll(true);
assert.deepEqual(calls, ['beginupdate', 'selectallrows', 'endupdate']);

// fast-anything style micro-benchmark for hot-path rewritePageParams
const t0 = performance.now();
for (let i = 0; i < 10000; i++) rewritePageParams('status=pending&pageNumber=2&user=abc');
const fastPathMs = performance.now() - t0;
assert.ok(fastPathMs < 500, `Fast-path too slow: ${fastPathMs}ms`);

console.log(`All regression, unslop & fast-path checks passed (10k fast-path calls: ${fastPathMs.toFixed(2)}ms).`);
