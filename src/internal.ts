export const add = (a: number, b: number): number => a + b;

export const greet = (name: string, options: { shout?: boolean } = {}): string => {
  const message = `Hello, ${name}.`;
  return options.shout ? message.toUpperCase().replace('.', '!') : message;
};

export const getRandomId = (rng: () => number = Math.random): string => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.floor(rng() * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .slice(0, 8);
  return `${timePart}-${randomPart}`;
};
