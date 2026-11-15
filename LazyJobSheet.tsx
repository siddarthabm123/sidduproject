import {lazy,Suspense} from 'react';
import type {ComponentProps} from 'react';
import {UiText} from './localization';
const JobSheet=lazy(()=>import('./JobSheet'));
export default function LazyJobSheet(props:ComponentProps<typeof JobSheet>){
  return <Suspense fallback={<p role="status"><UiText text="Loading work records…"/></p>}><JobSheet {...props}/></Suspense>;
}
