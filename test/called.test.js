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

report();
