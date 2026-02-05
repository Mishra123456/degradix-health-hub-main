import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ContactSection } from "@/components/ContactSection";

export default function ContactPage() {
    return (
        <MainLayout>
            <PageHeader
                title="Contact & Queries"
                description="Get in touch with our team or report issues"
            />

            <div className="max-w-2xl mx-auto mt-8">
                <ContactSection />
            </div>
        </MainLayout>
    );
}
