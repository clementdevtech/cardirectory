import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-card">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Privacy Policy</p>
                <h1 className="font-heading text-3xl md:text-4xl font-bold">Privacy Policy</h1>
                <p className="text-muted-foreground">
                  At CarDirectory, we value your privacy and are committed to protecting your personal information.
                </p>
              </div>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Information We Collect</h2>
                <p className="text-muted-foreground">
                  We collect information that you provide when creating an account, posting a vehicle, contacting us, or making a payment. This may include your name, email address, phone number, and account details.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">How We Use Your Information</h2>
                <p className="text-muted-foreground">
                  Your information is used to provide our services, verify your account, improve user experience, communicate with you, and process payments securely.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Data Security</h2>
                <p className="text-muted-foreground">
                  We take reasonable technical and organizational measures to protect your personal data from unauthorized access, disclosure, or misuse.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions about this policy, please contact us at info@cardirectory.co.ke.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
