import {UiText} from './localization';
export default function RouteLoading(){
 return <div className="route-loading" role="status" aria-live="polite"><p><UiText text="Opening this page…"/></p><div className="route-loading-grid" aria-hidden="true"><span/><span/><span/></div></div>;
}
