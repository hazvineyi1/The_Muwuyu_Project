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
// THREE THINGS ARE OPEN NOW, and they are the three reasons a card gets
// opened: what this person is to you, what is known about them, and how they
// are joined — the last being the one the family asked to be able to put right
// by tapping a name. The rest is two folds.
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

section('THE THREE THINGS A CARD IS OPENED FOR ARE OPEN');
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  const labels = (html.match(/<p class="lbl">([^<]*)/g) || [])
    .map(x => x.replace('<p class="lbl">', ''));
  eq('in the order somebody reads them',
     labels.slice(0, 3), ['To you', 'Who Sydney is', 'How Sydney is joined']);
  /* The section that was asked for by name: "allow the change/correction of
     relationships when you click the name". */
  check('and the joins are one of them, not behind a fold',
        html.indexOf('How Sydney is joined') < html.indexOf('data-fold'), 'joins are folded away');
}

section('AND THE REST IS TWO FOLDS, CLOSED');
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  eq('two of them', (html.match(/class="cardfold"/g) || []).length, 2);
  check('neither is open to begin with', !/cardfold"[^>]* open/.test(html), html.slice(0, 200));
  check('the rarer switches are in one', /More about Sydney/.test(html), html);
  check('and taking somebody out is in the other', /Take Sydney out/.test(html), html);
  /* Delete is the one thing on this card nobody opens it to do, and it was
     sitting between the family's records and the Save button. */
  const foldAt = html.indexOf('Take Sydney out');
  check('so delete is no longer between the records and Save',
        html.indexOf('id="cGone"') > foldAt, 'delete is still loose on the card');
}

section('and a fold left open stays open on the next card');
/* Somebody putting the public record right on six people should not have to
   open the same fold six times. */
{
  const t = family();
  t.fe.cardHtml(t.dad);
  t.fe.cardOpenSet().add('more');
  const again = t.fe.cardHtml(t.gf);
  check('it opens where they left it', /data-fold="more" open/.test(again), again.slice(0, 400));
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
{
  const t = family();
  const html = t.fe.cardHtml(t.dad);
  check('worked out from the joins below', /Worked out from the joins below/.test(html), html);
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
