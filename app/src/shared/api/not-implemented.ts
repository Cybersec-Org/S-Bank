/** Thrown by `http` repositories whose API endpoint does not exist yet; names the backlog item that adds it. */
export class NotImplementedYet extends Error {
  readonly backlogId: string;

  constructor(backlogId: string) {
    super(`Not implemented yet (${backlogId})`);
    this.name = 'NotImplementedYet';
    this.backlogId = backlogId;
  }
}
