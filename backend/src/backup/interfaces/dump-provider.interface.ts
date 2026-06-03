export const DUMP_PROVIDER = 'DUMP_PROVIDER';

export interface IDumpProvider {
  createDump(): Promise<Buffer>;
}
