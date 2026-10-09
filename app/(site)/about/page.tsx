import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/about")

export default function Page() {
  return <CmsPage path="/about" />
}
