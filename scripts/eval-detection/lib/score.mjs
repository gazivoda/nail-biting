// Precision and recall for one rule over a set of fixtures.
//
//   alarm   what a person hears: one per episode (replay.mjs applies the dedupe).
//   event   a labelled interval in a fixture: something the rule is meant to find.
//
// An alarm is CORRECT when it starts inside an event the rule is meant to find
// (startMs <= alarm <= endMs + graceMs), otherwise it is a FALSE alarm. An event is
// DETECTED when at least one correct alarm falls in it.
//
//   precision = correct alarms / all alarms        (what fraction of alarms were right)
//   recall    = detected events / all events       (what fraction of the real things were caught)
//
// Both are null when their denominator is zero (a rule that never alarmed has no
// precision; a rule with no events in the set has no recall).
//
// Events are counted per BEHAVIOUR the rule reports: a label lists the behaviours for
// which an alarm is correct, e.g. a hand at the mouth is correct for nail_biting and for
// cuticle_skin_biting. An alarm of ANOTHER behaviour inside an event does not make it correct.

export function scoreRule(results, behavior, { graceMs = 1000 } = {}) {
  let correct = 0;
  let falseAlarms = 0;
  let events = 0;
  let detected = 0;
  const falseList = [];
  const missedList = [];
  const perFixture = [];

  for (const { fixture, alarms } of results) {
    const mine = fixture.labels.filter(l => l.behaviors.includes(behavior));
    events += mine.length;
    const hit = new Set();
    let fixtureCorrect = 0;
    let fixtureFalse = 0;
    for (const alarm of alarms) {
      const event = mine.find(l => alarm.t >= l.startMs && alarm.t <= l.endMs + graceMs);
      if (event) { correct++; fixtureCorrect++; hit.add(event); }
      else { falseAlarms++; fixtureFalse++; falseList.push({ fixture: fixture.id, t: alarm.t }); }
    }
    detected += hit.size;
    for (const l of mine) if (!hit.has(l)) missedList.push({ fixture: fixture.id, startMs: l.startMs, endMs: l.endMs });
    perFixture.push({ id: fixture.id, events: mine.length, detected: hit.size, correct: fixtureCorrect, falseAlarms: fixtureFalse });
  }

  const alarms = correct + falseAlarms;
  return {
    behavior,
    alarms,
    correct,
    falseAlarms,
    events,
    detected,
    precision: alarms === 0 ? null : correct / alarms,
    recall: events === 0 ? null : detected / events,
    falseList,
    missedList,
    perFixture,
  };
}

/** Does a score meet a threshold pair? A null metric (nothing to measure) fails a bar only if the bar is above zero and it is recall. */
export function meets(score, { minPrecision = 0, minRecall = 0 }) {
  // A rule that never alarmed made no false alarms: precision is not the failure there, recall is.
  const precisionOk = score.precision === null || score.precision >= minPrecision;
  const recallOk = score.recall === null ? true : score.recall >= minRecall;
  return precisionOk && recallOk;
}
