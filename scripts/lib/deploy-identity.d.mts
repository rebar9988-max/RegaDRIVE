type BuildInfo = { contentMode?: string; buildId?: string; commit?: string } | null | undefined;
export function assertCurrentRelease(candidate: string | undefined, remoteMain: string | undefined): void;
export function assertLiveBuild(info: BuildInfo, expectedBuildId: string | undefined, expectedCommit?: string): void;
export function liveCommit(info: BuildInfo): string | null;
export function isAlreadyLive(info: BuildInfo, candidate: string | undefined): boolean;
