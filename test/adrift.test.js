// NAMES THAT ARE JOINED TO NOTHING, AND WHO THEY MIGHT ALREADY BE.
//
// "When people are adding and they duplicate, reconcile duplicated entries
//  and recognize and highlight them... don't let names float, they all need
//  to be linked and branching from somewhere. Auto reconcile. For example
//  Thomas Musoni, born in 1971 and his children should auto reconcile and be
//  showing on the correct branches."
//
// Sent with a photograph of two pods on the ground with no wood running to
// them at all. The app had no idea. Nothing counted them, nothing marked
// them, nothing said what to do — the tally said eleven and eleven is what
// it drew, so by every measure the app took, it was fine.
//
// THE BUG UNDERNEATH IT WAS WORSE, and the example given is exactly it.
// Thomas Musoni entered twice, once joined in and once floating, same name,
// same birth year, same mutupo. The duplicate scan scored that pair 0.15 —
// below even the threshold for "possible", so it appeared NOWHERE. Two
// signals had fired against it:
//
//   one generation apart   -0.45   his part of the tree had no origin to
//                                  count generations from, so he was given
//                                  nought and the real Thomas was at one
//   different children     -0.12   the man's children were split between
//                                  the two records
//
// Both are backwards. A generation number means nothing against one from a
// different walk, and children split between two records is the SIGNATURE of
// a split rather than evidence against it. Everything that reads the tree's
// shape is only evidence when both records are in the same tree.
//
// AND THE MERGE IS STILL NEVER AUTOMATIC. Three living Garikais in one
// family is ordinary, because children are named after their grandfathers.
// The app puts the guess in front of the person who knows, with the
// evidence, one tap from being acted on.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* The case that was sent: a man entered twice, once joined in and once on
   his own with a child under him. */
function split(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900');
  const thomas = fe.grow('child', gf, 'Thomas Musoni', 'm', 'Mwendamberi', { born:'1971' });
  const me = fe.grow('child', thomas, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1999' });
  fe.setMe(me);
  // somebody else's copy, entered from a funeral programme and never joined
  const stray = P('Thomas Musonza Musoni', 'm', 'Mwendamberi', '1971');
  const kid = fe.grow('child', stray, 'A child of his', 'f', 'Mwendamberi', { born:'2001' });
  return { fe, gf, thomas, me, stray, kid };
}
const nm = (t, id) => t.fe.getState().people[id].name;

section('A NAME JOINED TO NOTHING IS KNOWN TO BE ONE');
{
  const t = split();
  const lost = t.fe.adrift();
  eq('the stray and the child under him',
     lost.map(id => nm(t, id)).sort(), ['A child of his', 'Thomas Musonza Musoni']);
  check('and nobody who is joined on',
        !lost.includes(t.thomas) && !lost.includes(t.me) && !lost.includes(t.gf),
        JSON.stringify(lost.map(id => nm(t, id))));
}

section('and it is reckoned from YOU, not from the biggest lump');
/* A tree in two halves with no marriage between them has one half adrift,
   and which one is the question the app cannot answer and must not guess
   at. The half you are standing in is the tree. */
{
  const t = split();
  t.fe.setMe(t.stray);
  const lost = t.fe.adrift().map(id => nm(t, id)).sort();
  eq('standing in the other half turns it round',
     lost, ['Chaitezvi Musoni', 'Hazvineyi Musoni', 'Thomas Musoni']);
}

section('THE ONE THAT WAS SCORED 0.15 IS FOUND NOW');
/* The whole of the example. Same name, same year, same mutupo. */
{
  const t = split();
  const maybe = t.fe.mayAlreadyBe(t.stray);
  check('the floating copy is matched to the real one', !!maybe, String(maybe));
  eq('and it is the right man', nm(t, maybe.id), 'Thomas Musoni');
  check('with a score worth acting on', maybe.score >= 0.6, String(maybe.score));
  check('the name', maybe.why.some(w => /Thomas Musoni/.test(w)), JSON.stringify(maybe.why));
  check('the year', maybe.why.some(w => /born 1971/.test(w)), JSON.stringify(maybe.why));
  check('and the mutupo', maybe.why.some(w => /Mwendamberi/.test(w)), JSON.stringify(maybe.why));
}

section('and it is a POSSIBLE duplicate, so the scan lists it');
{
  const t = split();
  const pairs = t.fe.duplicatePairs()
    .map(d => [nm(t, d.a), nm(t, d.b)].sort().join(' / '));
  check('the pair is on the list',
        pairs.includes('Thomas Musoni / Thomas Musonza Musoni'), JSON.stringify(pairs));
}

section('A GENERATION NUMBER IS NEVER COMPARED ACROSS TWO PARTS');
/* The first of the two signals that were firing backwards. Somebody the walk
   never reached is given a row to stand on, not a generation that means
   anything. */
{
  const t = split();
  const g = t.fe.generations();
  check('the ones the walk never reached are marked as guesses',
        g.guessed && g.guessed.has(t.stray) && g.guessed.has(t.kid),
        JSON.stringify(g.guessed ? [...g.guessed].map(id => nm(t, id)) : null));
  check('and the ones it did reach are not',
        !g.guessed.has(t.thomas) && !g.guessed.has(t.me));
  check('their parts are recorded, and they are different parts',
        g.part.get(t.stray) !== g.part.get(t.thomas),
        JSON.stringify([g.part.get(t.stray), g.part.get(t.thomas)]));
  const m = t.fe.sameness(t.stray, t.thomas, g);
  check('so no generation is counted against them',
        !(m.against || []).some(x => /generation/.test(x)), JSON.stringify(m.against));
}

section('and neither are children split between two records');
{
  const t = split();
  const m = t.fe.sameness(t.stray, t.thomas);
  check('his children being on two records is not evidence against',
        !(m.against || []).some(x => /different children/.test(x)), JSON.stringify(m.against));
}

section('BUT INSIDE ONE TREE, EVERY ONE OF THOSE SIGNALS STILL FIRES');
/* The rule is about comparability, not about being lenient. Two men of the
   same name in one family, generations apart, are still two men — children
   are named after their grandfathers, so this is the ordinary case the
   penalties were written for, and they have to go on working.

   Grandfather and grandson never even reach the scoring: one is the other's
   ancestor, so they are ruled out before a score is asked for. The pair that
   does reach it is the one on a different line — a great-uncle and the boy
   named after him. */
{
  const fe = loadFrontend();
  const old = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const uncle = fe.grow('child', old, 'Tendai Musoni', 'm', 'Mwendamberi', { born:'1930' });
  const dad = fe.grow('child', old, 'Farai Musoni', 'm', 'Mwendamberi', { born:'1935' });
  const son = fe.grow('child', dad, 'A son', 'm', 'Mwendamberi', { born:'1960' });
  const boy = fe.grow('child', son, 'Tendai Musoni', 'm', 'Mwendamberi', { born:'1985' });
  fe.setMe(boy);

  const g = fe.generations();
  check('both are in the one tree, so their rows can be compared',
        g.part.get(uncle) === g.part.get(boy),
        JSON.stringify([g.part.get(uncle), g.part.get(boy)]));

  const m = fe.sameness(uncle, boy);
  check('a man and the boy named after him are still told apart',
        (m.against || []).some(x => /generation/.test(x)), JSON.stringify(m));
  check('and score below the threshold for a likely pair',
        m.score < 0.75, String(m.score));
}

section('and a man is never offered as a duplicate of his own grandson');
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Tendai Musoni', 'm', 'Mwendamberi', '1930', '');
  const dad = fe.grow('child', gf, 'A son', 'm', 'Mwendamberi', { born:'1955' });
  const grandson = fe.grow('child', dad, 'Tendai Musoni', 'm', 'Mwendamberi', { born:'1980' });
  fe.setMe(grandson);
  check('the question is refused outright', fe.sameness(gf, grandson) === null,
        JSON.stringify(fe.sameness(gf, grandson)));
}

section('THE TREE ITSELF SAYS WHICH NAMES ARE LOOSE');
{
  const t = split();
  const html = t.fe.draw();
  eq('two pods marked', (html.match(/class="pod[^"]*adrift/g) || []).length, 2);
  check('each saying so in words', /class="loose"/.test(html), html.slice(0, 200));
  check('and saying it is not an error',
        /nothing is wrong with the record/.test(html), 'no reassurance on the mark');
  check('the joined ones are not marked',
        !new RegExp(`data-id="${t.thomas}"[^>]*adrift`).test(html));
}

section('AND THE ROOM OFFERS THE MATCH, WITH THE EVIDENCE');
{
  const t = split();
  const room = t.fe.adriftRoom();
  check('the floating name is listed', /Thomas Musonza Musoni/.test(room), room.slice(0, 300));
  check('with who it may already be',
        /This may be <b>Thomas Musoni<\/b>/.test(room), room);
  check('and why the app thinks so', /both born 1971/.test(room), room);
  check('a way to look at that one', /data-lostsee=/.test(room), room);
  check('a way to join this one on', /data-lostjoin=/.test(room), room);
  check('and a way to say they are two different people',
        /data-lostno=/.test(room), room);
  check('it says how many came in with the floating one',
        /1 person recorded under them/.test(room), room);
  /* Counted downwards. The child floating under him has nobody of her own,
     and her own floating father is not somebody "under" her. */
  check('and the child under him is not told she has somebody under her',
        (room.match(/recorded under them/g) || []).length === 1, room);
}

section('and a floating name with no match says that plainly');
{
  const fe = loadFrontend();
  const a = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const me = fe.grow('child', a, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.addPerson('Musekiwa Maxwell Mupfunde', 'm', 'Mupfunde', '1950', '');
  const room = fe.adriftRoom();
  check('no match is invented',
        /Nobody in the tree looks like the same person/.test(room), room);
  check('and it still offers the way to join them on',
        /data-lostjoin=/.test(room), room);
}

section('NOTHING IS MERGED BY ANY OF IT');
/* The offer is an offer. Three living Garikais in one family is ordinary. */
{
  const t = split();
  t.fe.adriftRoom();
  t.fe.adrift();
  t.fe.mayAlreadyBe(t.stray);
  eq('both records are still there',
     Object.keys(t.fe.getState().people).length, 5);
  check('and both are still separate people',
        !!t.fe.getState().people[t.stray] && !!t.fe.getState().people[t.thomas]);
}

section('AND ONCE JOINED ON, THEY STOP BEING ADRIFT');
{
  const t = split();
  check('adrift to start with', t.fe.adrift().includes(t.stray));
  t.fe.linkExisting('sibling', t.thomas, t.stray);
  eq('and joined on, nobody is floating', t.fe.adrift(), []);
  const html = t.fe.draw();
  eq('and no pod is marked', (html.match(/class="pod[^"]*adrift/g) || []).length, 0);
}

section('A TREE WITH ONE PERSON IN IT HAS NOBODY ADRIFT');
{
  const fe = loadFrontend();
  const only = fe.addPerson('The first name', 'f', 'Nzou', '1950', '');
  fe.setMe(only);
  eq('the first person is not floating', fe.adrift(), []);
  eq('and the room says so', fe.adriftRoom(), '');
}

report();
