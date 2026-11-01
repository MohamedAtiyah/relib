import { route } from "@/lib/route";
import { SourcesInput } from "@/lib/schemas";
import { searchSources } from "@/lib/sources";

export const POST = route(SourcesInput, 30, ({ topics }) => searchSources(topics));
