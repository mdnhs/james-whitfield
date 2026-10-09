import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/privacy")

export default function Page() {
  return <CmsPage path="/privacy" />
}
