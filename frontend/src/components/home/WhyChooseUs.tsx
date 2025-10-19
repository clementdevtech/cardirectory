import { ShieldCheck, Clock, Users, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: ShieldCheck,
    title: "Verified Dealers",
    description: "All dealers are verified with proper documentation and KRA PIN",
  },
  {
    icon: Clock,
    title: "Quick & Easy",
    description: "Find and buy your dream car in just 3 simple steps",
  },
  {
    icon: Users,
    title: "Expert Support",
    description: "Our team is ready to help you 24/7 throughout your journey",
  },
  {
    icon: BadgeCheck,
    title: "Quality Assured",
    description: "Every listing is reviewed to ensure accuracy and quality",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Why Choose <span className="text-primary">CarDirectory</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your trusted partner for buying and selling cars in Kenya
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="text-center shadow-card hover:shadow-card-hover transition-smooth">
                <CardContent className="p-6 space-y-4">
                  <div className="inline-flex p-4 rounded-full gradient-hero">
                    <Icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="font-heading font-semibold text-xl">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
