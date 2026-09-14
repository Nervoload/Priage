import { handleOptions, handleVerifyDemoCode, type PagesFunction } from '../_shared/demoAccess';

export const onRequestPost: PagesFunction = ({ request, env }) => handleVerifyDemoCode(request, env);

export const onRequestOptions: PagesFunction = () => handleOptions(['POST', 'OPTIONS']);
