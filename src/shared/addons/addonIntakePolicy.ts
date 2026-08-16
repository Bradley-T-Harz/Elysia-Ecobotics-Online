export const generatedVendorDirectories = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "target",
  "venv",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".cache",
  "coverage"
] as const;

const generatedVendorDirectorySet = new Set<string>(generatedVendorDirectories);

export function generatedVendorDirectoryForPath(input: string) {
  const parts = input.replace(/\\/g, "/").replace(/^\.\//, "").split("/").filter(Boolean);
  return parts.find((part) => generatedVendorDirectorySet.has(part.toLowerCase())) ?? null;
}

const privateAbsolutePathPatterns = [
  /(?:^|[\s"'=([{])\/(?:home\/[^/\s"'<>]+|Users\/[^/\s"'<>]+|root)(?:\/[^\s"'<>]*)?/m,
  /(?:^|[\s"'=([{])file:\/\/\/[^\s"'<>]*/im,
  /(?:^|[\s"'=([{])[A-Za-z]:[\\/][^\r\n"'<>]*/m
];

export function containsPrivateAbsolutePath(value: string) {
  return privateAbsolutePathPatterns.some((pattern) => pattern.test(value));
}
