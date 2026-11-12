import { describe, expect, it } from 'vitest';
import { fastA11y } from '../src/index.js';

const violations = (html: string, rule = 'aria-hidden-focus') => fastA11y(html, {
  runOnly: { type: 'rule', values: [rule] },
}).violations;

describe('static rendering visibility and keyboard focus', () => {
  it.each([
    '<button aria-hidden="true" style="visibility: hidden; position:absolute"></button>',
    '<button aria-hidden="true" hidden>Send</button>',
    '<div hidden><button aria-hidden="true">Send</button></div>',
    '<div style="display:none"><div aria-hidden="true"><a href="/">Home</a></div></div>',
    '<div aria-hidden="true"><span style="visibility:hidden"><button>Send</button></span></div>',
    '<div aria-hidden="true"><input type="HIDDEN"></div>',
    '<div aria-hidden="true" inert><button>Send</button></div>',
    '<div inert><button aria-hidden="true">Send</button></div>',
    '<div aria-hidden="true"><template><button>Send</button></template></div>',
    '<button aria-hidden="true" style="DISPLAY: /* comment */ NONE !important; display:block">Send</button>',
    '<button aria-hidden="true" style="visibility:collapse">Send</button>',
  ])('does not flag content excluded from keyboard navigation: %s', html => {
    expect(violations(html)).toEqual([]);
  });

  it.each([
    '<button aria-hidden="true">Send</button>',
    '<div aria-hidden="true"><button>Send</button></div>',
    '<div aria-hidden="true"><span hidden>Hidden</span><a href="/">Home</a></div>',
    '<button aria-hidden="true" style="display:none; display:block">Send</button>',
    '<button aria-hidden="true" style="--display:none; background:url(display:none)">Send</button>',
    '<div aria-hidden="true" style="visibility:hidden"><button style="visibility:visible">Send</button></div>',
    '<button aria-hidden="true" style="opacity:0">Send</button>',
  ])('still flags keyboard-focusable content hidden only from assistive technology: %s', html => {
    expect(violations(html)).toHaveLength(1);
  });
});

describe('landmark content', () => {
  const page = (outside: string) => `<html><body><main><h1>Page</h1></main>${outside}</body></html>`;
  it.each([
    '<div id="app-root"></div>',
    '<div> <!-- placeholder --> <span> </span></div>',
    '<div><span hidden>Not shown</span></div>',
    '<div><span style="display:none">Not shown</span></div>',
    '<div><script>let x = 1;</script><style>body{color:red}</style></div>',
  ])('ignores empty or hidden-only containers: %s', html => {
    expect(violations(page(html), 'region')).toEqual([]);
  });
  it.each([
    '<div>Announcement</div>',
    '<div><img src="/image.png" alt="Chart"></div>',
    '<div><button aria-label="Open menu"></button></div>',
    '<div><svg aria-label="Chart"></svg></div>',
    '<div><a href="/" aria-label="Home"></a></div>',
  ])('preserves findings for visible text and non-text content: %s', html => {
    expect(violations(page(html), 'region')).toHaveLength(1);
  });
});
