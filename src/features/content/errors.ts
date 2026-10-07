export type ContentErrorReason =
  | "invalid-url"
  | "unsupported-source"
  | "not-found"
  | "too-large"
  | "read-failed";

export class ContentError extends Error {
  constructor(
    readonly reason: ContentErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "ContentError";
  }
}
