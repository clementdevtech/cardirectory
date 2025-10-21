import { Link } from "react-router-dom";
import { Car, Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="bg-muted border-t border-border mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className=" rounded-lg">
                <img
              src={logo}
              alt="CarDirectory Logo"
              className="h-8 w-8 object-contain rounded-md"
            />
              </div>
              <span className="font-heading text-xl font-bold">
                Car<span className="text-primary">Directory</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Buy & Sell Cars in Kenya — Fast, Safe & Secure
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/cars" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Browse Cars
                </Link>
              </li>
              <li>
                <Link to="/dealers" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Dealers
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link to="/post-vehicle" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Post a Vehicle
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Contact Us
                </Link>
              </li>
              {/*<li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth text-sm">
                  Cookie Policy
                </a>
              </li>*/}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Nairobi, Kenya CBD</span>
              </li>
              <li className="flex items-start space-x-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>+254 700 020 020</span>
              </li>
              <li className="flex items-start space-x-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>info@cardirectory.co.ke</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} CarDirectory Kenya. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
