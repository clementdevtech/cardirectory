import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const TermsOfService = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-card">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Terms of Service</p>
                <h1 className="font-heading text-3xl md:text-4xl font-bold">Terms of Service</h1>
                <p className="text-muted-foreground">
                  By using CarDirectory, you agree to the following terms and conditions.
                </p>
              </div>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Use of the Platform</h2>
                <p className="text-muted-foreground">
                  You may use CarDirectory to browse vehicles, list vehicles for sale, and connect with buyers or sellers. You agree to provide accurate information and use the platform lawfully.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Account Responsibility</h2>
                <p className="text-muted-foreground">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Payments and Transactions</h2>
                <p className="text-muted-foreground">
                  Any payments made through the platform are subject to our payment terms and applicable laws. CarDirectory may suspend accounts that violate platform rules.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions about these terms, please contact us at info@cardirectory.co.ke.
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

export default TermsOfService;
