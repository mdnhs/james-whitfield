import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/insights")

export default function Page() {
  return <CmsPage path="/insights" />
}
