import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQSection: React.FC = () => {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
          <p className="mt-3 text-xl text-gray-500">
            Everything you need to know about BytSave
          </p>
        </div>
        
        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-medium text-gray-900">
                How does BytSave track Amazon prices?
              </AccordionTrigger>
              <AccordionContent className="text-base text-gray-700">
                BytSave connects to Amazon's Product Advertising API to fetch real-time pricing data for products you want to track. Our system checks prices regularly (approximately every few hours) and compares them against your target price.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-medium text-gray-900">
                Is BytSave completely free to use?
              </AccordionTrigger>
              <AccordionContent className="text-base text-gray-700">
                BytSave offers a free plan that allows you to track up to 10 products simultaneously. We also offer premium plans for users who want to track more items or need additional features like price history graphs and customized notification schedules.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-medium text-gray-900">
                How do I find the ASIN for an Amazon product?
              </AccordionTrigger>
              <AccordionContent className="text-base text-gray-700">
                The ASIN (Amazon Standard Identification Number) can be found in the product URL or in the product details section on Amazon. It's typically a 10-character alphanumeric code (e.g., B01EXAMPLE). With BytSave, you can simply paste the entire Amazon product URL and we'll extract the ASIN automatically.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-medium text-gray-900">
                Do I need to create an account to use BytSave?
              </AccordionTrigger>
              <AccordionContent className="text-base text-gray-700">
                While you can track a product without creating an account, we recommend signing up for a free BytSave account. This allows you to manage your tracked items across devices, view your price alert history, and ensure you don't lose your tracking data if you clear your browser cookies.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
