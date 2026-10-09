import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/how-it-works")

export default function Page() {
  return <CmsPage path="/how-it-works" />
}
