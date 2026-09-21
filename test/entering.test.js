// HOW TO ENTER A NAME, SAID BY THE FIELD THAT TAKES IT.
//
// "Have clearer instructions on how to enter, from their names, but don't let
//  names float, they all need to be linked and branching from somewhere."
//
// The field said "Name" and nothing else, so two things that matter were
// never said to anybody.
//
// A TITLE IS NOT A NAME. Sekuru, Mai, Baba, Tete are words for somebody, and
// nameTokens() sets them aside before two records are ever compared — so the
// same man entered as "Sekuru Thomas" by one relative and "Thomas" by another
// is recognised as one man either way. That is good behaviour nobody could
// see, and invisible good behaviour is not trusted.
//
// A LONE FIRST NAME is the commonest way one man ends up in a tree twice. The
// second person to write him down has nothing to recognise him by, so they
// write him down again. The field is where that can still be prevented.
//
// AND EVERY ADD SAYS WHERE IT HANGS. The form only said "Recorded as child of
// Thomas" when the add had come in by a Shona word; the plain adds said
// nothing, and a plain add is exactly where somebody wonders whether they
// have just made a loose name.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function tree(){
  const fe = loadFrontend();
  const gf = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const dad = fe.grow('child', gf, 'Thomas Musoni', 'm', 'Mwendamberi', { born:'1971' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1999' });
  fe.setMe(me);
  return { fe, gf, dad, me };
}

section('AN EMPTY FIELD SAYS WHAT TO WRITE IN IT');
{
  const { fe } = tree();
  const said = fe.nameHelp('');
  check('it asks for the name the family uses', /name the family uses/i.test(said), said);
  check('says one is enough to start', /one name is enough/i.test(said), said);
  check('and says what a second one buys you', /recognise/i.test(said), said);
}

section('A TITLE IS NAMED AS A TITLE, AND WHAT IS LEFT IS SHOWN');
{
  const { fe } = tree();
  const said = fe.nameHelp('Sekuru Thomas Musoni');
  check('the title is called what it is', /Sekuru is what you call them/.test(said), said);
  check('and the name they are matched on is spelled out',
        /Thomas Musoni/.test(said), said);
  /* The point of saying it: the app really does compare them on that, so two
     relatives spelling the honorific differently still meet in the middle. */
  eq('and it is telling the truth about the comparison',
     fe.nameTokens('Sekuru Thomas Musoni'), fe.nameTokens('Thomas Musoni'));
  check('a woman’s title the same way', /^Mai is what you call them/.test(fe.nameHelp('Mai Rudo')),
        fe.nameHelp('Mai Rudo'));
}

section('A TITLE ON ITS OWN IS NOT A NAME AT ALL');
{
  const { fe } = tree();
  const said = fe.nameHelp('Sekuru');
  check('it says so', /not a name/.test(said), said);
  /* And says where the word actually comes from, because the app derives
     every one of them and a typed one would be a stale one. */
  check('and where the word for them really comes from',
        /worked out from the tree/.test(said), said);
}

section('ONE NAME IS ACCEPTED AND STILL ANSWERED');
{
  const { fe } = tree();
  const said = fe.nameHelp('Thomas');
  check('nothing is refused', !/must|cannot|required/i.test(said), said);
  check('but the cost of a lone first name is said once',
        /family name as well/.test(said) && /writing them down again/.test(said), said);
}

section('AND A NAME THAT NEEDS NOTHING SAID GETS NOTHING SAID');
{
  const { fe } = tree();
  eq('a full name is left alone', fe.nameHelp('Thomas Musoni'), '');
}

section('EVERY ADD SAYS WHAT IT BRANCHES FROM');
{
  const { fe, dad } = tree();
  for (const kind of ['child', 'parent', 'partner', 'sibling']){
    const html = fe.formHtml(kind, dad);
    check(`a plain ${kind} says where it hangs`,
          /Recorded as [^<]*<b>Thomas Musoni<\/b>/.test(html), html.slice(0, 260));
    check(`and says that is the rule, not this one add`,
          /Every name in the tree branches from somebody/.test(html), 'no such line');
  }
}

section('and the one that came in by a Shona word still does too');
{
  const { fe, dad } = tree();
  const html = fe.formHtml('child', dad, { term:'Mwana', gloss:'your child' });
  check('the word is the heading', /New <b>Mwana<\/b>/.test(html), html.slice(0, 200));
  check('and the line underneath says where they land',
        /Recorded as child of <b>Thomas Musoni<\/b>/.test(html), html.slice(0, 300));
}

section('THE FIELDS SAY WHAT THEY TAKE');
{
  const { fe, dad } = tree();
  const html = fe.formHtml('child', dad);
  check('the name field asks for a name', /placeholder="Their name"/.test(html), html.slice(0, 200));
  check('there is somewhere for the hint to go', /id="fNameWhy"/.test(html), 'no hint line');
  /* Birth order is reckoned from the year, so the year is worth asking for
     plainly rather than leaving somebody to guess what a date should look
     like. */
  /* Half a row wide, so what it asks for has to fit inside it — "Born — a
     year is enough" was cut off at "Born — a ye" on a real screen. */
  check('and the year fields ask for a year, in words that fit the field',
        /placeholder="Year born"/.test(html) && /placeholder="Year died"/.test(html),
        html.slice(0, 500));
}

section('AND THE OFFER TO JOIN RATHER THAN RE-ENTER IS STILL THERE');
/* The other half of not writing the same man down twice, and it must not
   have been pushed off the panel by any of this. */
{
  const { fe, dad } = tree();
  const html = fe.formHtml('child', dad);
  check('the form still carries the name field the offers hang off',
        /id="fName"/.test(html), html.slice(0, 200));
}

report();
