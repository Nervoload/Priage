import { handleCallbackRequest, handleOptions, type PagesFunction } from '../_shared/demoAccess';

export const onRequestPost: PagesFunction = ({ request, env }) => handleCallbackRequest(request, env);

export const onRequestOptions: PagesFunction = () => handleOptions(['POST', 'OPTIONS']);
