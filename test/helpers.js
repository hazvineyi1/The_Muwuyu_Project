// Minimal test harness. No framework — the app has two runtime dependencies
// and it is worth keeping it that way.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createPool } = require('../db/pool');
const { migrate } = require('../db/migrate');

const TEST_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

let passed = 0, failed = 0;
const failures = [];

function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ok    ${label}`); }
  else { failed++; failures.push(label); console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ''}`); }
  return cond;
}

const eq = (label, actual, expected) =>
  check(label, JSON.stringify(actual) === JSON.stringify(expected),
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// Assert that a call fails, and how.
async function rejects(label, fn, { status, code } = {}) {
  try {
    await fn();
    return check(label, false, 'expected a rejection, but it succeeded');
  } catch (e) {
    if (status && e.status !== status) return check(label, false, `expected status ${status}, got ${e.status ?? '(none)'}: ${e.message}`);
    if (code && e.code !== code) return check(label, false, `expected code ${code}, got ${e.code ?? '(none)'}: ${e.message}`);
    return check(label, true);
  }
}

function section(name) { console.log(`\n${name}`); }

async function freshPool() {
  if (!TEST_URL) {
    console.error('TEST_DATABASE_URL (or DATABASE_URL) must be set to run the tests.');
    process.exit(2);
  }
  const pool = createPool(TEST_URL);
  await migrate(pool, () => {});
  return pool;
}

async function newTree(pool, name = 'test') {
  const { rows } = await pool.query('INSERT INTO trees (name) VALUES ($1) RETURNING id', [name]);
  return rows[0].id;
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) { console.log('failures:'); failures.forEach(f => console.log(`  - ${f}`)); }
  process.exit(failed ? 1 : 0);
}

// ── run the frontend's own code, whole, in a stubbed DOM ──────────────────
//
// Not an extract of it: the entire <script> from the shipped page, evaluated
// against a stand-in for the browser. Testing a copied fragment would only
// prove the fragment agrees with itself, and any drift in index.html would go
// unnoticed. This way the functions under test are literally the ones the
// family's browsers run.
function loadFrontend(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  let src = html.split('<script>')[1].split('</script>')[0];

  // The page kicks itself off by loading the shared tree and painting it.
  // Everything after that is what we want to call directly, so the boot line
  // is the one statement that has to go.
  src = src.replace(/\nload\(\);\s*$/, '\n/* boot skipped under test */\n');
  if (/\nload\(\);/.test(src)) throw new Error('frontend boot call was not neutralised');

  // A DOM stand-in that absorbs whatever the page does to it. It is never
  // inspected — the tests only call the pure model and scoring functions —
  // so it just has to be permissive enough that top-level wiring runs.
  const node = () => new Proxy(function(){}, {
    get(t, k){
      if (k === 'style' || k === 'classList' || k === 'dataset') return node();
      if (k === 'children' || k === 'rows') return [];
      if (k === Symbol.toPrimitive || k === 'toString') return () => '';
      if (k === 'length') return 0;
      return node();
    },
    set(){ return true; },
    apply(){ return node(); }
  });

  const sandbox = {
    console,
    document: { getElementById: node, createElement: node, querySelector: node,
                querySelectorAll: () => [], body: node(),
                documentElement: { dataset: {} } },
    addEventListener(){}, removeEventListener(){},
    innerWidth: 1280, innerHeight: 800,
    setTimeout, clearTimeout, Math, JSON, Date, Set, Map, Object, Array, String, Number,
    /* A REAL ONE, not a stub that always answers null. The page keeps what
       belongs to a device here — the theme, the shape, the reach, and which
       families are folded away — and a stub that forgets everything makes
       every one of those look like it works when nothing was ever written.
       Backed by a Map so a suite can prove a setting survives being read
       back, and cleared for each fresh tree. */
    localStorage: (() => {
      const m = new Map();
      return {
        getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
        setItem(k, v){ m.set(String(k), String(v)); },
        removeItem(k){ m.delete(String(k)); },
        clear(){ m.clear(); }
      };
    })(),
    // The page reads the family key out of the address; under test there is
    // no address, so this is what it reads instead.
    location: { protocol:'https:', origin:'https://example.test',
                pathname:'/', hash:'', reload(){} },
    fetch: () => Promise.reject(new Error('offline under test')),
    confirm: () => false
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + `
    this.api = {
      sameness, duplicatePairs, likelyDuplicates, generations, nameTokens,
      nameSimilarity, mustBeDifferent, birthYear, parentUnionOf, partnersOf,
      relationship, kinTerms, kinPath, overlaps, grow, addPerson, addUnion,
      teachTerm, forgetTerm, affirmTerm, lexicon, shapeLabel, kinVerdict,
      teachFor, termCredit, kinOnCard, kinCensus, bandLabel, westernWord, wordSplits, teknonym, matchesName, houseName, houseOf, waysToAdd, waysToJoin, parentBySex, branchFrom, startBuild, closeBuild, draw, setShape, setReach,
      frontier, isOpenEnd, descendantsOf, toggleRoot,
      parentageOptions, parentageOf, setParentage, unionForShare, unionsOf, reorder,
      olderThan, seniorityConflicts, birthYear, whyNotNamed,
      setAside, restore, deleteForever, unlinkParents, unlinkPartner, searchPeople, deleteInOneTap, putThemBack, closeDeleteWindow, noticesFor, asidePeople, present, mergePeople, meName,
      knownTotem, totemKey, totemsHere, totemSuggestions, MITUPO,
      sameHouse, mutupoNotes, housesJoined, housesJoin,
      familyLines, foldableLines, foldedAway, forgetLines, isFolded, loadFolded, FAM_TINTS, famPanel,
      whyHere(id){ computeLayout(); return whyHere(id); }, positionOf,
      whyOnCard(id){ computeLayout(); return whyOnCard(id); },
      branchPath, BAR, yearOf, hubRooms, hubMark, startAgain,
      saidWhat, newsLines, whenWords, newsCount, markSeen, loadSeen,
      budWords, PLAIN_BUDS, waysToAdd,
      focusIds, setFocusLifts, loadFocus, adrift, mayAlreadyBe, adriftRoom,
      nameHelp, setLoose, hereWords,
      BONDS, bondBetween, setBond, bondLine, widowedIn, marriageBlock,
      mergedRoom, setAutoMerged(list){ autoMerged = list; }, lightWord,
      pick(id){ sel = id; },
      budsHtml(id){ sel = id; computeLayout(); placeBuds(); return budsHtml(); },
      seenTo(n){ seenSeq = n; }, headTo(n){ headSeq = n; },
      sharedNow(){ store = 'shared'; },
      // The grow form as it is built, so a suite can read what it offers.
      formHtml(kind, anchorId, said){ openForm(kind, anchorId, said); return formInk; },
      /* And the card, the same way — captured off the element the page
         builds, because the stubbed document keeps nothing. */
      // And the card, the same way.
      cardHtml(id){ openCard(id); return cardInk; },
      cardOpenSet(){ return cardOpen; },
      treeSvg(){ draw(); return treeSvg(); },
      // The standing notices on the bar, as the page assembles them.
      barNotices(){ const out = []; const el = { hidden:false,
        set innerHTML(v){ out.push(v); }, get innerHTML(){ return out[0] || ''; } };
        const was = document.getElementById;
        document.getElementById = id => (id === 'litbar' ? el : was(id));
        try { computeLayout(); showLit(); } finally { document.getElementById = was; }
        return out[0] || ''; },
      setLineFolded(id, on){ setLineFolded(id, on); },
      clearFolds(){ folded = new Set(); },
      PALETTES, THEMES,
      diffOps, remapId, familyLink, titleFor, treeStamp, TITLE_BUDGET,
      seniorSide, insertByAge, canLink, linkExisting, linkCandidates, KIND_AS,
      rowsOutOfOrder, sortRowByAge, sortAllRowsByAge, seniorityConflicts,
      moveChildTo, slotAt, rowAnchor,
      // Undo is a click handler in the page; this is the same two lines, so a
      // test can prove an edit is reversible rather than assume it.
      undo(){ if (!history.length) return false; state = JSON.parse(history.pop()); return true; },
      // The drawn picture, for the tests that are about where people stand.
      layoutOf(){ computeLayout(); return layout; },
      rowOf(id){ computeLayout();
        const xs = Object.entries(layout.persons)
          .filter(([, q]) => q.y === layout.persons[id].y)
          .sort((a, b) => a[1].x - b[1].x).map(([k]) => k);
        return xs; },
      setMe(id){ meId = id; },
      setState(s){ state = s; }, getState(){ return state; },
      // The device's own settings, so a suite can see what was written and
      // hand the page back a device that already had an opinion.
      prefs: localStorage
    };`, sandbox);
  if (typeof sandbox.api.sameness !== 'function'){
    throw new Error('the frontend script did not expose sameness()');
  }
  return sandbox.api;
}


module.exports = { check, eq, rejects, section, freshPool, newTree, report, loadFrontend };
