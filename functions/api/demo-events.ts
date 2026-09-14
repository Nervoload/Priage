import { handleDemoEvent, handleOptions, type PagesFunction } from '../_shared/demoAccess';

export const onRequestPost: PagesFunction = ({ request, env }) => handleDemoEvent(request, env);

export const onRequestOptions: PagesFunction = () => handleOptions(['POST', 'OPTIONS']);
