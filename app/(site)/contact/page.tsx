import { CmsPage, cmsMetadata } from "../_cms/cms-page"

export const generateMetadata = () => cmsMetadata("/contact")

export default function Page() {
  return <CmsPage path="/contact" />
}
