import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/terms")

export default function Page() {
  return <CmsPage path="/terms" />
}
