// THE CARD BEHIND A PERSON.
//
// "Do not make this hard for people to use, make it easy for them to
//  understand how to add." — and then, plainly: "fix the card."
//
// It was fourteen blocks in one scroll, 1638 pixels of it measured on a real
// screen against a viewport of 790. The kinship word, a paragraph about the
// kinship word, a button, a fold about the drawing, the name, the other name,
// a note about teknonyms, She/He, born, died, the mutupo, the end of the line,
// a note about houses, whose child, who they are joined to, the public record,
// this-is-me, show-only-this-branch, set aside, delete for good, save. Every
// one of them earns its place on somebody's screen one day a year, and every
// one of them was on everybody's screen every time.
//
// THREE THINGS WERE OPEN AFTER THAT, and they were the three reasons a card
// gets opened: what this person is to you, what is known about them, and how
// they are joined. Two of those three are forms.
//
// SO ONE THING IS OPEN NOW. "A person card might initially contain only:
// name, relationship to me, photo, house/branch, show relationship. Then:
// More about Rudo ↓ reveals dates, mutupo, other names, history,
// relationships, sources, editing controls."
//
// A relative who taps their aunt to find out what she is to them was handed a
// name field, an also-known-as field, She/He, two year boxes, a mutupo box and
// then the joins, and had to work out that the answer was the one line above
// all of it. The card answers first and offers second now: the word, which
// side of the family, and four obvious things to do. The record is one tap
// away behind a fold that says what is in it.
//
// NOTHING MOVED OUT OF REACH AND NOTHING WAS DROPPED — see below.
//
// AND NOTHING WAS TAKEN AWAY. That is the test that matters most in this file:
// every control that was on the card is still on the card. A tidy-up that
// quietly drops the thing somebody needed once a year is worse than the scroll.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function family(){
  const fe = loadFrontend();
  const gf = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  fe.grow('child', dad, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  return { fe, gf, dad, me };
}

/* EVERY CONTROL THAT WAS ON THE CARD BEFORE THIS CHANGE. Written out rather
   than counted, so that dropping one is a named failure and not a number that
   moved. */
const CONTROLS = ['cName', 'cAlso', 'cSex', 'cBorn', 'cDied', 'cTotem',
                  'cParents', 'cMarriages', 'cJoin', 'cRoot', 'cVis', 'cMe',
                  'cBuild', 'cAside', 'cGone', 'cSave', 'cNo'];

section('NOTHING WAS TAKEN AWAY');
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  const missing = CONTROLS.filter(c => !html.includes(`id="${c}"`));
  eq('every control is still there', missing, []);
}

section('WHAT A CARD SAYS BEFORE IT ASKS ANYTHING');
/* The answer, whose people they are, and what there is to do. In that order,
   and all of it before the first box anybody could type in. */
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  const labels = (html.match(/<p class="lbl">([^<]*)/g) || [])
    .map(x => x.replace('<p class="lbl">', ''));
  eq('the first thing is what they are to you, in the family\u2019s words',
     labels[0], 'Hukama hwenyu');
  check('and which side of the family they are of',
        /class="branchof">Of the <b>Musoni<\/b> side/.test(html), html.slice(0, 300));

  const firstField = html.indexOf('<input id="cName"');
  const firstDo    = html.indexOf('class="nextup"');
  check('the things to do come before the first thing to fill in',
        firstDo > -1 && firstDo < firstField, { firstDo, firstField });
}

section('and there is always an obvious next action');
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  for (const [id, what] of [['cRel',  'see the whole relationship'],
                            ['cShow', 'show them on the tree'],
                            ['cKin',  'see everyone recorded around them'],
                            ['cAdd',  'add something about them']])
    check(html.includes(`id="${id}"`), what, html.slice(0, 200));
  /* Reckoned from somebody, like every other word in this app. There is no
     relationship to a person who is not related to anybody. */
  const alone = family();
  alone.fe.setMe(null);
  check(!alone.fe.cardHtml(alone.dad).includes('id="cRel"'),
        'except the relationship one, where there is nobody to be related to');
}

section('AND THE RECORD IS ONE TAP AWAY, NOT IN THE WAY');
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  eq('two folds', (html.match(/class="cardfold"/g) || []).length, 2);
  check('neither is open to begin with', !/cardfold"[^>]* open/.test(html), html.slice(0, 200));
  check('one holds the record, and says so', /More about Sydney/.test(html), html);
  check('and taking somebody out is in the other', /Take Sydney out/.test(html), html);

  /* THE FIELDS, THE JOINS AND THE RARE SWITCHES ARE ALL IN THE FIRST ONE.
     They were three separate things on one scroll; they are one thing now,
     because they are one thing — what is recorded about this person. */
  const rec = html.indexOf('data-fold="record"');
  const out = html.indexOf('data-fold="out"');
  for (const [what, at] of [['the name field', html.indexOf('id="cName"')],
                            ['the joins', html.indexOf('How Sydney is joined')],
                            ['the rare switches', html.indexOf('id="cRoot"')],
                            ['and Save, which belongs with them',
                             html.indexOf('id="cSave"')]])
    check(at > rec && at < out, `${what} is behind the record fold`, { at, rec, out });

  /* Delete is the one thing on this card nobody opens it to do. */
  check(html.indexOf('id="cGone"') > out, 'and delete is in the other one');
}

section('and a fold left open stays open on the next card');
/* Somebody putting the public record right on six people should not have to
   open the same fold six times. */
{
  const t = family();
  t.fe.cardHtml(t.dad);
  t.fe.cardOpenSet().add('record');
  const again = t.fe.cardHtml(t.gf);
  check('it opens where they left it', /data-fold="record" open/.test(again), again.slice(0, 400));
  check('and the other one did not follow it',
        !/data-fold="out" open/.test(again), again);
}

section('THE EXPLANATIONS ARE ONE LINE, AND THE REST A TAP AWAY');
/* Measured: the paragraphs came to 268 pixels of a 1638-pixel card, every one
   of them worth reading exactly once. */
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  check('what Together and Parted mean is offered, not recited',
        /<summary>What do Together and Parted mean\?<\/summary>/.test(html), html);
  check('and so is why whose-child matters',
        /<summary>Why does this matter\?<\/summary>/.test(html), html);
  /* The words themselves are still there, behind the summary — folded, not
     deleted. */
  check('the full explanation is still in the card',
        /divorce and separation are one answer here/.test(html), html);
  check('and the one-line version is what shows',
        /Only the join goes — everybody keeps their name/.test(html), html);
}

section('AND THE LINE ABOUT A WRONG WORD POINTS AT THE SECTION THAT FIXES IT');
/* It used to say "below", which was true while the joins were the next thing
   on the scroll. Behind a fold, "below" points at nothing — so it names the
   fold instead, by the words written on it. */
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  check('the word is worked out from the joins', /Worked out from the joins/.test(html), html);
  check('and the card says where those joins are, by name',
        /under <b>More about Sydney<\/b>/.test(html), html);
  check('which is a fold that really is on this card',
        html.includes('More about Sydney'), html);
}

section('A CARD FOR SOMEBODY WITH NO WORD TO YOU STILL HAS EVERYTHING ELSE');
/* The "To you" section is the only one that can be absent — there is no word
   between you and yourself. */
{
  const t = family();
  const html = t.fe.cardHtml(t.me);
  check('no "To you" on your own card', !/<p class="lbl">To you<\/p>/.test(html), html.slice(0, 200));
  /* cMarriages is the one control that comes and goes with the tree rather
     than with the layout: an unmarried person has no marriages to show, and
     an empty "Joined to" heading would be the card asking a question with no
     answers under it. */
  const missing = CONTROLS.filter(c => c !== 'cMarriages' && !html.includes(`id="${c}"`));
  eq('and every other control is still there', missing, []);
  check('no empty marriage block for somebody unmarried',
        !html.includes('id="cMarriages"'), 'an empty Joined to');
  check('and it still says who they are', /Who Hazvineyi is/.test(html), html);
}

report();
