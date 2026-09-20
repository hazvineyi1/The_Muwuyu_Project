// What people are actually called.
//
// Esther is Mai Revai. Not a nickname, not an alias: from the day her first
// child was born that is what the neighbours call her, what the church roll
// says, what is read out at her funeral. Her husband is Baba Revai. A
// western record has no slot for this at all — it has a maiden name and a
// married name, both of which are her husband's business, and no way to say
// that a woman is known by her child.
//
// The app cannot know it, because families differ on which child it is and
// because some people are never called it. So it is offered and never
// applied, which is the same rule as every other word here.
//
// It also found something plainer: the other-name field could be typed into
// and was then shown nowhere. A family who had written down that Esther is
// Mai Revai still saw a tree full of names nobody uses out loud, and could
// not find her by the only name half of them know her by.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function household(){
  const fe = loadFrontend();
  const ben = fe.addPerson('Ben Musoni', 'm', 'Mwendamberi', '1958', '');
  const esther = fe.grow('partner', ben, 'Esther', 'f', 'Shava', { born:'1960' });
  const revai = fe.grow('child', ben, 'Revai', 'f', 'Mwendamberi', { born:'1985' });
  const tanaka = fe.grow('child', ben, 'Tanaka', 'm', 'Mwendamberi', { born:'1988' });
  return { fe, ben, esther, revai, tanaka };
}

section('A PARENT IS NAMED AFTER THEIR FIRST CHILD');
{
  const h = household();
  eq('she is Mai Revai', h.fe.teknonym(h.esther).text, 'Mai Revai');
  eq('and he is Baba Revai', h.fe.teknonym(h.ben).text, 'Baba Revai');
  eq('it says which child it took the name from',
     h.fe.teknonym(h.esther).child, h.revai);
}

section('the FIRST child, across every marriage, not the first one entered');
/* A man's first child by a first wife is the one he is named for, whichever
   household somebody happened to type in first. */
{
  const fe = loadFrontend();
  const man = fe.addPerson('Man', 'm', 'Nzou', '1940', '');
  const w2 = fe.grow('partner', man, 'Second wife', 'f', 'Moyo', { born:'1955' });
  const late = fe.grow('child', w2, 'Chipo', 'f', 'Nzou', { born:'1978' });
  const w1 = fe.grow('partner', man, 'First wife', 'f', 'Shava', { born:'1944' });
  const early = fe.grow('child', w1, 'Tendai', 'm', 'Nzou', { born:'1966' });
  eq('the eldest of all of them', fe.teknonym(man).text, 'Baba Tendai');
  eq('and each wife by her own', fe.teknonym(w2).text, 'Mai Chipo');
}

section('nobody is named for a child who is not there');
{
  const h = household();
  const alone = h.fe.addPerson('Nobody’s parent', 'f', 'Shava', '1970', '');
  eq('a woman with no children has no such name', h.fe.teknonym(alone), null);
  h.fe.setAside(h.revai, 'entered twice');
  eq('and a child set aside no longer names their mother',
     h.fe.teknonym(h.esther).text, 'Mai Tanaka');
}

section('and not where the app does not know whether to say Mai or Baba');
// It is a sexed title and there is no neutral form of it. Guessing would be
// the one thing this app never does.
{
  const fe = loadFrontend();
  const p = fe.addPerson('Somebody', '', 'Nzou', '1950', '');
  fe.grow('child', p, 'Their child', 'm', 'Nzou', { born:'1975' });
  eq('no title, no name', fe.teknonym(p), null);
}

section('THE OTHER NAME IS A NAME YOU CAN LOOK SOMEBODY UP BY');
/* The fault: it could be typed in and was then matched by nothing. Half the
   family knows her only as Mai Revai. */
{
  const h = household();
  const esther = h.fe.getState().people[h.esther];
  esther.also = 'Mai Revai';
  check('by the name on her birth record', h.fe.matchesName(esther, 'esth'));
  check('and by the name she is called', h.fe.matchesName(esther, 'mai rev'));
  check('and not by somebody else’s', !h.fe.matchesName(esther, 'tanaka'));
  check('an empty search still finds everybody', h.fe.matchesName(esther, ''));
}

section('a name that is already written down is not offered again');
// The card offers the name; it does not argue with the one that is there.
{
  const h = household();
  const esther = h.fe.getState().people[h.esther];
  esther.also = 'Mai vaRevai';
  check('the family had their own way of writing it, and it is kept',
        esther.also === 'Mai vaRevai');
  // The offer is made by the card only when the field is empty — asserted
  // here as the rule it is, so a rewrite of the card cannot quietly lose it.
  eq('and the derivation itself is unchanged', h.fe.teknonym(h.esther).text, 'Mai Revai');
}

// ── the houses of a household ──────────────────────────────────────────────
//
// A man with more than one wife does not have one set of children. He has
// houses: each wife and her children are an imba, and the family names them
// that way — vana vaMai Revai, the children of Mai Revai's house. It decides
// who is spoken for by whom and who inherits what, and brothers of one house
// are closer to each other than to brothers of another though all of them
// are brothers.
//
// A western tree has one word for the whole of that, "half", which is about
// fractions of shared blood and is not what a house is about at all.

function polygynous(){
  const fe = loadFrontend();
  const man = fe.addPerson('Sekuru', 'm', 'Nzou', '1935', '');
  const ruth  = fe.grow('partner', man, 'Ruth', 'f', 'Shava', { born:'1940' });
  const grace = fe.grow('partner', man, 'Grace', 'f', 'Moyo', { born:'1950' });
  const tendai = fe.grow('child', ruth,  'Tendai', 'm', 'Nzou', { born:'1962' });
  const chipo  = fe.grow('child', grace, 'Chipo', 'f', 'Nzou', { born:'1975' });
  return { fe, man, ruth, grace, tendai, chipo };
}

section('EACH WIFE AND HER CHILDREN ARE A HOUSE, AND THE HOUSE IS HERS');
{
  const h = polygynous();
  const houses = h.fe.layoutOf().houses;
  eq('two wives, two houses', houses.length, 2);
  eq('each named by its own mother', houses.map(x => x.text).sort(),
     ['Imba yaGrace', 'Imba yaRuth']);
  eq('and a child knows which house they are of',
     h.fe.houseOf(h.tendai).text, 'Imba yaRuth');
  eq('as does their half-brother', h.fe.houseOf(h.chipo).text, 'Imba yaGrace');
}

section('by the name the family actually calls her');
// Which is usually the one the house is known by: imba yaMai Tendai.
{
  const h = polygynous();
  h.fe.getState().people[h.ruth].also = 'Mai Tendai';
  eq('her own name for it', h.fe.houseOf(h.tendai).text, 'Imba yaMai Tendai');
}

section('NOT NUMBERED, because this app does not know when a marriage happened');
/* First house and second house are real and they matter. They are the order
   of the marriages, and nothing in this record says when a marriage was. To
   number them by the wives' birth years would be inventing a fact about a
   family's own seniority, which is the last thing to guess at. */
{
  const h = polygynous();
  const said = h.fe.layoutOf().houses.map(x => x.text).join(' ');
  check('nothing claims to be the first', !/first|1st|yekutanga/i.test(said), said);
  check('nor the second', !/second|2nd|yechipiri/i.test(said), said);
}

section('a household with one wife has no houses to tell apart');
{
  const fe = loadFrontend();
  const man = fe.addPerson('Man', 'm', 'Nzou', '1940', '');
  const wife = fe.grow('partner', man, 'Wife', 'f', 'Shava', { born:'1944' });
  const kid = fe.grow('child', man, 'Child', 'm', 'Nzou', { born:'1970' });
  eq('nothing is drawn', fe.layoutOf().houses.length, 0);
  eq('and the child is told nothing they did not know', fe.houseOf(kid), null);
}

section('nor does a marriage with nobody in it yet');
// It is a house when there are children in it to tell apart.
{
  const fe = loadFrontend();
  const man = fe.addPerson('Man', 'm', 'Nzou', '1940', '');
  fe.grow('partner', man, 'First', 'f', 'Shava', { born:'1944' });
  const second = fe.grow('partner', man, 'Second', 'f', 'Moyo', { born:'1955' });
  fe.grow('child', man, 'Only child', 'm', 'Nzou', { born:'1970' });
  const houses = fe.layoutOf().houses;
  eq('only the house with children in it is named', houses.length, 1);
  eq('and it is named by the mother of them', houses[0].called, 'First');
}

section('and where both of them married more than once, the app says nothing');
/* Two sets of houses crossing each other. Which set the children belong to
   is a question for the family, not for the drawing — and a picture that
   answered it would be answering with a guess. */
{
  const fe = loadFrontend();
  const man = fe.addPerson('Man', 'm', 'Nzou', '1940', '');
  const her = fe.grow('partner', man, 'Her', 'f', 'Shava', { born:'1944' });
  fe.grow('partner', man, 'His other wife', 'f', 'Moyo', { born:'1950' });
  const hers = fe.addPerson('Her other husband', 'm', 'Soko', '1938', '');
  fe.addUnion([her, hers], []);
  fe.grow('child', man, 'Their child', 'm', 'Nzou', { born:'1970' });
  const theirs = Object.keys(fe.getState().people).find(
    k => fe.getState().people[k].name === 'Their child');
  eq('no house is claimed', fe.houseOf(theirs), null);
}

report();
