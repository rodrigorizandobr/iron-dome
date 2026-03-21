import { HttpStatus } from '@nestjs/common';

/**
 * Centralized Error Code Registry.
 * Every application error maps to a unique code, HTTP status, and i18n key.
 */
export enum ErrorCode {
  INTERNAL_ERROR = 'ERR_INTERNAL',
  VALIDATION_FAILED = 'ERR_VALIDATION',
  NOT_FOUND = 'ERR_NOT_FOUND',
  UNAUTHORIZED = 'ERR_UNAUTHORIZED',
  FORBIDDEN = 'ERR_FORBIDDEN',
  TENANT_REQUIRED = 'ERR_TENANT_REQUIRED',
  CREATE_FAILED = 'ERR_CREATE_FAILED',
  UPDATE_FAILED = 'ERR_UPDATE_FAILED',
  DELETE_FAILED = 'ERR_DELETE_FAILED',
  RATE_LIMITED = 'ERR_RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'ERR_SERVICE_UNAVAILABLE',
}

interface ErrorDefinition {
  httpStatus: HttpStatus;
  i18nKey: string;
}

/** Maps each ErrorCode to its HTTP status and i18n translation key. */
export const ERROR_REGISTRY: Record<ErrorCode, ErrorDefinition> = {
  [ErrorCode.INTERNAL_ERROR]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    i18nKey: 'ERROR_INTERNAL',
  },
  [ErrorCode.VALIDATION_FAILED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    i18nKey: 'errors.validation_failed',
  },
  [ErrorCode.NOT_FOUND]: {
    httpStatus: HttpStatus.NOT_FOUND,
    i18nKey: 'errors.not_found',
  },
  [ErrorCode.UNAUTHORIZED]: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    i18nKey: 'errors.unauthorized',
  },
  [ErrorCode.FORBIDDEN]: {
    httpStatus: HttpStatus.FORBIDDEN,
    i18nKey: 'errors.forbidden',
  },
  [ErrorCode.TENANT_REQUIRED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    i18nKey: 'errors.tenant_required',
  },
  [ErrorCode.CREATE_FAILED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    i18nKey: 'errors.create_failed',
  },
  [ErrorCode.UPDATE_FAILED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    i18nKey: 'errors.update_failed',
  },
  [ErrorCode.DELETE_FAILED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    i18nKey: 'errors.delete_failed',
  },
  [ErrorCode.RATE_LIMITED]: {
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    i18nKey: 'errors.rate_limited',
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    i18nKey: 'errors.service_unavailable',
  },
};
