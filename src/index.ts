export type {
  ClientOptions,
  Fetch,
  HttpMethod,
  Logger,
  QueryValue,
  RequestOptions,
  ResourceRequestOptions,
} from './client.js';
export { PDFMonkey } from './client.js';

export {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PDFMonkeyError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from './error.js';
export type { PaginationMeta } from './pagination.js';
export { Page } from './pagination.js';
export type { CurrentUser } from './resources/current-user.js';
export { CurrentUserResource } from './resources/current-user.js';
export type {
  DocumentCard,
  DocumentCardListParams,
} from './resources/document-cards.js';
export { DocumentCards } from './resources/document-cards.js';
export type {
  DocumentTemplate,
  DocumentTemplateCard,
  DocumentTemplateCreateParams,
  DocumentTemplateListParams,
  DocumentTemplateUpdateParams,
} from './resources/document-templates.js';
export { DocumentTemplates } from './resources/document-templates.js';
export type {
  Document,
  DocumentCreateParams,
  DocumentMeta,
  DocumentPayload,
  DocumentStatus,
  DocumentUpdateParams,
  GenerateSyncOptions,
  GenerateSyncParams,
  WaitForGenerationOptions,
} from './resources/documents.js';
export { DEFAULT_SYNC_TIMEOUT, Documents, parseMeta } from './resources/documents.js';
export type { PdfEngine } from './resources/pdf-engines.js';
export { PdfEngines } from './resources/pdf-engines.js';
export type { RestHook, RestHookCreateParams } from './resources/rest-hooks.js';
export { RestHooks } from './resources/rest-hooks.js';
export type {
  Snippet,
  SnippetCreateParams,
  SnippetListParams,
  SnippetUpdateParams,
} from './resources/snippets.js';
export { Snippets } from './resources/snippets.js';
export type {
  TemplateFolder,
  TemplateFolderCreateParams,
  TemplateFolderListParams,
  TemplateFolderUpdateParams,
} from './resources/template-folders.js';
export { TemplateFolders } from './resources/template-folders.js';
export type { Workspace, WorkspaceListParams } from './resources/workspaces.js';
export { Workspaces } from './resources/workspaces.js';
export { VERSION } from './version.js';
export type {
  VerifyWebhookOptions,
  WebhookEvent,
  WebhookEventType,
  WebhookHeaders,
} from './webhooks.js';
export { verifyWebhook } from './webhooks.js';
