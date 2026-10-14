function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error("A print document image failed to load."));
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("A print document image failed to load."));
    };

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
  });
}

export async function prepareAndPrint(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Printing is only available in a browser.");
  }

  await document.fonts.ready;
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      ".print-area img, [data-print-root] img",
    ),
  );
  await Promise.all(images.map(waitForImage));

  // The browser prints document.title in its own page header — blank it so
  // no stray title line appears on the printed sheet, then restore it.
  const previousTitle = document.title;
  document.title = "";
  try {
    window.print();
  } finally {
    document.title = previousTitle;
  }
}
