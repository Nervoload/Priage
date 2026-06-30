import { handleDemoSession, handleOptions, type PagesFunction } from '../_shared/demoAccess';

export const onRequestGet: PagesFunction = ({ request, env }) => handleDemoSession(request, env);

export const onRequestOptions: PagesFunction = () => handleOptions(['GET', 'OPTIONS']);
