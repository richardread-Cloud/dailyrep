// DailyRep opening-screen quotes: hard work and achievement.
// Attributed lines were all published before 1929. Lines by 'DailyRep' are the app's own.
// Loads as a plain script (window.DailyRepQuotes) or as a CommonJS module.
(function (global) {
  const QUOTES = [
  { q: 'Far and away the best prize that life offers is the chance to work hard at work worth doing.', by: 'Theodore Roosevelt' },
  { q: 'Nothing ever comes to one, that is worth having, except as a result of hard work.', by: 'Booker T. Washington' },
  { q: 'If there is no struggle, there is no progress.', by: 'Frederick Douglass' },
  { q: 'One more rep than last time. That is the whole plan.', by: 'DailyRep' },
  { q: 'Great works are performed, not by strength, but perseverance.', by: 'Samuel Johnson' },
  { q: 'Diligence is the mother of good luck.', by: 'Benjamin Franklin' },
  { q: 'The harder the conflict, the more glorious the triumph.', by: 'Thomas Paine' },
  { q: 'Strength is built on ordinary days.', by: 'DailyRep' },
  { q: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', by: 'Will Durant, summing up Aristotle' },
  { q: 'Genius is one per cent inspiration, ninety-nine per cent perspiration.', by: 'Thomas Edison' },
  { q: 'There are no gains without pains.', by: 'Benjamin Franklin' },
  { q: 'The bar weighs the same on the days you don\'t feel like it. Lift it anyway.', by: 'DailyRep' },
  { q: 'They can because they think they can.', by: 'Virgil' },
  { q: 'Nothing great was ever achieved without enthusiasm.', by: 'Ralph Waldo Emerson' },
  { q: 'The credit belongs to the man who is actually in the arena.', by: 'Theodore Roosevelt' },
  { q: 'Show up, add a little, repeat.', by: 'DailyRep' },
  { q: 'Without labour nothing prospers.', by: 'Sophocles' },
  { q: 'Well done is better than well said.', by: 'Benjamin Franklin' },
  { q: 'No great thing is created suddenly.', by: 'Epictetus' },
  { q: 'Do the thing, and you shall have the power.', by: 'Ralph Waldo Emerson' },
  { q: 'Chance favours only the prepared mind.', by: 'Louis Pasteur' },
  ];
  // One quote per calendar day, in the Lifter's local time zone. Consecutive days step through
  // the list in order, so every quote is shown once before any repeats.
  function quoteForDate(date = new Date()) {
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
  }
  const api = { QUOTES, quoteForDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.DailyRepQuotes = api;
})(typeof window !== 'undefined' ? window : globalThis);
