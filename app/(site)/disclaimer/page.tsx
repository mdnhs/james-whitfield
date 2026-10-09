import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/disclaimer")

export default function Page() {
  return <CmsPage path="/disclaimer" />
}
