import React from "react";
import { Helmet } from "react-helmet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <>
      <Helmet>
        <title>Frequently Asked Questions | BytSave</title>
        <meta name="description" content="Find answers to the most common questions about price tracking and deal notifications with BytSave." />
      </Helmet>
      
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h1>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-medium">
                How does BytSave price tracking work?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                BytSave monitors Amazon product prices several times daily. Enter any Amazon product URL or ASIN, set your desired price, and we'll notify you when the price drops below your target. Our system records price history so you can see trends and make informed purchasing decisions.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-medium">
                Is BytSave free to use?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Yes! BytSave is completely free to use. We earn commissions through Amazon's Associates program when you purchase through our affiliate links, which allows us to provide this service at no cost to you.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-medium">
                How do I get notifications when prices drop?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                When you track a product, you'll provide your email address. We'll send you an email notification as soon as the price drops below your target price, with a direct link to purchase the item on Amazon.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-medium">
                How accurate are the prices shown?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                We fetch prices directly from Amazon using their official Product Advertising API, ensuring that the prices we show are accurate and up-to-date. However, Amazon prices can change frequently, and there might be a short delay between price changes and our updates.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-medium">
                Can I track any Amazon product?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                You can track most Amazon products that have a standard ASIN (Amazon Standard Identification Number). Some products like digital items, services, or certain limited-time offers may not be trackable due to API limitations.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-medium">
                How do I view my tracked products?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                After signing in, you can access your Dashboard to view all your tracked products, modify target prices, or remove items you're no longer interested in.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-7">
              <AccordionTrigger className="text-lg font-medium">
                What are Amazon Associates promotions?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                We feature special Amazon promotions like seasonal events or category-specific deals (such as beauty products). These promotions are curated selections of Amazon products with competitive pricing or special discounts that we think you might be interested in.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-8">
              <AccordionTrigger className="text-lg font-medium">
                How often do you update the featured deals?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                We update our featured deals and promotions several times daily to ensure we're showing the latest Amazon offers. Seasonal promotions are refreshed when new Amazon campaigns are launched.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </>
  );
}