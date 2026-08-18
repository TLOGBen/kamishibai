/**
 * The wire vocabulary shared by the dev server and the runtime it injects.
 *
 * Both halves are written in this repository and shipped together, but they run
 * in different processes and are wired by strings. One table of those strings
 * is what stops the browser half from listening on a path the server half
 * stopped serving — a drift that shows up as "reload silently stopped working",
 * the single most expensive failure mode a preview server has.
 *
 * Every dev-only route lives under one reserved prefix so that nothing a
 * template could ever emit collides with it.
 */

/** Reserved prefix for everything the preview server adds to a page. */
export const DEV_PREFIX = '/__kamishibai'

/** SSE stream the injected runtime subscribes to. */
export const EVENTS_PATH = `${DEV_PREFIX}/events`
/** Comment collection: `GET` lists, `POST` appends. */
export const COMMENTS_PATH = `${DEV_PREFIX}/comments`

/** SSE event names. `reload` is the one CONTRACT E1 pins. */
export const RELOAD_EVENT = 'reload'
export const ERROR_EVENT = 'error'
/** Sent once on connect so a client can tell "subscribed" from "server hung". */
export const READY_EVENT = 'ready'

/**
 * The marker that identifies the injected runtime.
 *
 * It is asserted *absent* from every rendered and exported artifact (CONTRACT
 * E2). That pin only means something if the marker is a single distinctive
 * token that appears nowhere else, so it is defined here and used verbatim by
 * both the injector and the test.
 */
export const DEV_RUNTIME_MARKER = 'kamishibai-dev-overlay'
