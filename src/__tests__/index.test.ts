import { describe, expect, it } from 'vitest';
import type { DocumentStatus, HttpMethod, QueryValue, WebhookEventType } from '../index.js';
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  CurrentUserResource,
  DocumentCards,
  Documents,
  DocumentTemplates,
  InternalServerError,
  NotFoundError,
  Page,
  PDFMonkey,
  PDFMonkeyError,
  PermissionDeniedError,
  RateLimitError,
  RestHooks,
  Snippets,
  TemplateFolders,
  UnprocessableEntityError,
  VERSION,
  verifyWebhook,
  Workspaces,
} from '../index.js';

describe('Barrel exports', () => {
  it('exports PDFMonkey client', () => {
    expect(PDFMonkey).toBeDefined();
  });

  it('exports all error classes', () => {
    expect(PDFMonkeyError).toBeDefined();
    expect(APIError).toBeDefined();
    expect(BadRequestError).toBeDefined();
    expect(AuthenticationError).toBeDefined();
    expect(PermissionDeniedError).toBeDefined();
    expect(NotFoundError).toBeDefined();
    expect(UnprocessableEntityError).toBeDefined();
    expect(RateLimitError).toBeDefined();
    expect(InternalServerError).toBeDefined();
    expect(APIConnectionError).toBeDefined();
  });

  it('exports Page class (not fetchPage or APIResource)', () => {
    expect(Page).toBeDefined();
  });

  it('exports resource classes', () => {
    expect(Documents).toBeDefined();
    expect(DocumentCards).toBeDefined();
    expect(DocumentTemplates).toBeDefined();
    expect(RestHooks).toBeDefined();
    expect(Snippets).toBeDefined();
    expect(TemplateFolders).toBeDefined();
    expect(Workspaces).toBeDefined();
    expect(CurrentUserResource).toBeDefined();
  });

  it('exports VERSION string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exports verifyWebhook', () => {
    expect(typeof verifyWebhook).toBe('function');
  });

  it('exports DocumentStatus type', () => {
    const status: DocumentStatus = 'success';
    expect(status).toBe('success');
  });

  it('exports HttpMethod type', () => {
    const method: HttpMethod = 'GET';
    expect(method).toBe('GET');
  });

  it('exports QueryValue type', () => {
    const value: QueryValue = 42;
    expect(value).toBe(42);
  });

  it('exports WebhookEventType type', () => {
    const eventType: WebhookEventType = 'document.done';
    expect(eventType).toBe('document.done');
  });
});
