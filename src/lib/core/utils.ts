export function shuffle(array: any[]) {
  if (array.length <= 1) {
    return array;
  }

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

export function group(array: any[], groupSize: number) {
  if (array.length === 0) return [];

  const groups: any[][] = [];

  for (let i = 0; i < array.length; i += groupSize) {
    groups.push(array.slice(i, i + groupSize));
  }

  return groups;
}

export function bufferToDataURL(buffer: Buffer<ArrayBuffer>) {
  const base64 = buffer.toString("base64");
  const url = `data:image/png;base64,${base64}`;
  return url;
}

export function getPromiseAndResolve<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

export function fnv1a(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function assertStudent(
  locals: App.Locals
): asserts locals is App.StudentLocals {
  if (locals.userType !== "student") {
    throw new Error("User is not a student");
  }
}
