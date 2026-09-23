// Everyone already recorded around one person.
//
// "To avoid duplication, the relationships that are added should show when
//  clicking on a person. Maybe they can open up in a space and show a list of
//  the relationships, and the person can filter for 10, 20, 30, 50, 100 etc
//  relatives to show at a time. Allow for relationship editing."
//
// The card showed a person's parents and their marriages and stopped there —
// not their children, not their brothers and sisters, nobody further out. So
// the question a relative actually has before typing a name, "is this one
// already in here?", could only be answered by panning round the drawing.
//
// That is how a tree gets two of somebody. Duplicates are not made by people
// who do not care; they are made by people who cannot see what is there.

const { check, eq, section, report, loadFrontend } = require('./helpers');

(async () => {

/* A family with every shape in it: two rows above, brothers and sisters
   either side, a marriage, children below, and an aunt off to one side. */
function family(){
  const fe = loadFrontend();
  const gf  = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const gm  = fe.grow('partner', gf, 'Sarah Moyo', 'f', 'Nzou', { born:'1905' });
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
  const tete = fe.grow('child', gf, 'Ruth Musoni', 'f', 'Mwendamberi', { born:'1941' });
  const mum = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const me  = fe.grow('child', dad, 'Musekiwa Musoni', 'm', 'Mwendamberi', { born:'1968' });
  const sis = fe.grow('child', dad, 'Bertha Musoni', 'f', '', { born:'1972' });
  const wife = fe.grow('partner', me, 'Valerie Ferenandi', 'f', 'Shava', { born:'1972' });
  const son = fe.grow('child', me, 'Anotenda Musoni', 'm', '', { born:'1998' });
  fe.setMe(me);
  return { fe, gf, gm, dad, tete, mum, me, sis, wife, son };
}

section('EVERY RELATIVE IS THERE, not only the ones the card was showing');
{
  const t = family();
  const rows = t.fe.relativesOf(t.me);
  const ids = rows.map(r => r.id);
  const name = id => t.fe.getState().people[id].name;

  eq('everybody else in the tree is listed', rows.length,
     Object.keys(t.fe.getState().people).length - 1);
  check('his father, which the card already showed', ids.includes(t.dad), '');
  check('his mother, which it also showed', ids.includes(t.mum), '');
  /* The three the card never showed at all, and the reason this exists. */
  check('his CHILD, which the card never showed', ids.includes(t.son), '');
  check('his SISTER, which the card never showed', ids.includes(t.sis), '');
  check("his father's sister, further out again", ids.includes(t.tete), '');
  check('and his grandparents', ids.includes(t.gf) && ids.includes(t.gm), '');
  check('nobody is listed twice',
        new Set(ids).size === ids.length, ids.map(name).join(', '));
  check('and he is not in his own list', !ids.includes(t.me), '');
}

section('SORTED BY HOW CLOSE, because closeness is what the question is about');
{
  const t = family();
  const rows = t.fe.relativesOf(t.me);
  const firstFour = rows.slice(0, 4).map(r => r.how);
  check('the people joined to him directly come first',
        rows.slice(0, 5).every(r => r.how),
        JSON.stringify(rows.map(r => r.how)));
  check('parents before the rest of them',
        firstFour[0] === 'parent' && firstFour[1] === 'parent',
        JSON.stringify(firstFour));
  const far = rows[rows.length - 1];
  check('and the furthest out is last, with how many steps away it is',
        !far.how && far.away >= 2, JSON.stringify(far));
  check('everybody carries a distance', rows.every(r => r.away >= 1),
        JSON.stringify(rows.map(r => r.away)));
}

section('AND HOW EACH ONE IS JOINED, which is what can be corrected from the list');
{
  const t = family();
  const by = new Map(t.fe.relativesOf(t.me).map(r => [r.id, r]));
  eq('his father is a parent', by.get(t.dad).how, 'parent');
  eq('his mother is a parent', by.get(t.mum).how, 'parent');
  eq('his wife is a partner', by.get(t.wife).how, 'partner');
  eq('his son is a child', by.get(t.son).how, 'child');
  eq('his sister is a sister', by.get(t.sis).how, 'sibling');
  check('his grandfather is not joined to him directly, so there is nothing ' +
        'on that row to correct', !by.get(t.gf).how, JSON.stringify(by.get(t.gf)));
  check('every direct row names the household it is in',
        [...by.values()].every(r => !r.how || r.union), '');
}

section('a person nobody is joined to has an empty list rather than a broken one');
{
  const fe = loadFrontend();
  const only = fe.addPerson('The first name', 'f', 'Nzou', '1950', '');
  fe.setMe(only);
  eq('nothing to show', fe.relativesOf(only), []);
}

section('and somebody set aside is not in anybody\'s list');
{
  /* Set aside means out of the picture. A list that still carried them would
     be offering a relationship to a record the family has taken out. */
  const t = family();
  t.fe.setAside(t.sis, 'entered twice');
  const ids = t.fe.relativesOf(t.me).map(r => r.id);
  check('she is gone from it', !ids.includes(t.sis), '');
  check('and everybody else is still there', ids.includes(t.dad) && ids.includes(t.son), '');
}

section('THE PANEL IS BUILT FROM IT, and says what it is for');
{
  const html = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
  check('there is a way in from the card', /id="cKin"/.test(html));
  check('named so it is obvious what it opens',
        /See everyone recorded around/.test(html));
  check('and it says why to look', /the same person twice/.test(html));

  check('the list can be narrowed', /id="relQ"/.test(html));
  check('by a name or by a word', /a word like Sekuru/.test(html));

  check('how many at a time is asked', /id="relSize"/.test(html));
  check('with the sizes the family asked for',
        /RELATIVES_SIZES = \[10, 20, 50, 100\]/.test(html));
  check('and all of them at once', /data-size="all"/.test(html));
  check('there is a way to the next page', /id="relNext"/.test(html));
  check('and back', /id="relPrev"/.test(html));
  check('saying where you are in the list', /Showing \$\{from \+ 1\}/.test(html));

  /* EDITING, on the rows where there is one link to edit. */
  check('a marriage can be pointed at somebody else', /data-relswap=/.test(html));
  check('and a join can be taken out', /data-relcut=/.test(html));
  check('each button names the one link it takes out, rather than all saying ' +
        'the same thing', /CUTNAME = \{ parent: 'Not their parent'/.test(html));
  check('and every row opens the person',   /data-relopen=/.test(html));

  /* The two rules this list must not break. */
  check('nothing here cuts anybody loose', /keptJoined\(wereLoose, 'Taking that join out'\)/.test(html));
  check('and a refusal keeps the list open at the same place',
        /\{ again\(\); return; \}/.test(html));
}

report();
})();
