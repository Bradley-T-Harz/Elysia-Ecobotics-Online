// Prospective September 15 references. Historical manifests are immutable.
export const firstPartyLegalPageIntegrity = {
  "donation-recognition-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/donation-recognition-terms",
    "contentSha256": "163d10c650662cf6540a77134467155769c1b0f6f4e16593efb73068a06b490c"
  },
  "privacy-policy": {
    "version": "2026-09-15-first-party",
    "path": "/legal/privacy-policy",
    "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
  },
  "terms-of-use": {
    "version": "2026-09-15-first-party",
    "path": "/legal/terms-of-use",
    "contentSha256": "b80425e56e15a3955a0324ce0f78f816eecb745404bdc8da0c752712d0f7cf09"
  },
  "support-and-billing-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
  },
  "refund-and-cancellation-policy": {
    "version": "2026-09-15-first-party",
    "path": "/legal/refund-and-cancellation-policy",
    "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
  },
  "sandbox-credit-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/sandbox-credit-terms",
    "contentSha256": "66442c1f4121e708c2b15607e0ec7820a3ca778e0711c198e9e2b5f6e373041f"
  },
  "job-post-fee-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/job-post-fee-terms",
    "contentSha256": "95f83ff1829e2e607823bd0391b7248dacad931b7c42a1f650cbb099a20ce975"
  },
  "marketplace-commerce-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/marketplace-commerce-terms",
    "contentSha256": "8571a6b26521027d887b17bd20eef3dbdd78d1b7f9aa96d15681135775bb316c"
  },
  "sponsorship-independence-policy": {
    "version": "2026-09-15-first-party",
    "path": "/legal/sponsorship-independence-policy",
    "contentSha256": "3b912386160729427f09698530fd7ab68d9c69bbf776ecb69c8a504bb9db8433"
  },
  "organization-services-terms": {
    "version": "2026-09-15-first-party",
    "path": "/legal/organization-services-terms",
    "contentSha256": "14762a98e13634e603714f78d0e1e1fc7abf0a13e77661f8df2ea5a3e126a807"
  },
  "account-closure-financial-retention": {
    "version": "2026-09-15-first-party",
    "path": "/legal/account-closure-financial-retention",
    "contentSha256": "8deca77f3d11256f71e25a2bf5e23037916bdd7195bfc95d6acf1d03780f569b"
  }
} as const;
export const billingLegalDocumentIntegrityExpectations = {
  "supportOneTime": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
  },
  "supportRecurring": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
  },
  "supportRecognition": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
  },
  "dataExportRequest": {
    "version": "2026-09-15-first-party",
    "path": "/legal/privacy-policy",
    "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
  },
  "economicAccountClosureRequest": {
    "version": "2026-09-15-first-party",
    "path": "/legal/account-closure-financial-retention",
    "contentSha256": "8deca77f3d11256f71e25a2bf5e23037916bdd7195bfc95d6acf1d03780f569b"
  },
  "marketplaceSellerAgreement": {
    "version": "2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
  },
  "marketplaceFreeSellerAgreement": {
    "version": "2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
  },
  "stripeConnectSellerDisclosure": {
    "version": "stripe-connect-test-2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
  },
  "marketplaceBuyerTerms": {
    "version": "2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
  }
} as const;
export const billingLegalConsentBundleIntegrityExpectations = {
  "support_one_time_checkout_bundle": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "documents": {
      "supportTerms": {
        "version": "2026-09-15-first-party",
        "path": "/legal/support-and-billing-terms",
        "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
      },
      "refundPolicy": {
        "version": "2026-09-15-first-party",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
      },
      "privacyDisclosure": {
        "version": "2026-09-15-first-party",
        "path": "/legal/privacy-policy",
        "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
      }
    }
  },
  "support_recurring_checkout_bundle": {
    "version": "2026-09-15-first-party",
    "path": "/legal/support-and-billing-terms",
    "documents": {
      "recurringSupportTerms": {
        "version": "2026-09-15-first-party",
        "path": "/legal/support-and-billing-terms",
        "contentSha256": "f9365af5d54f53c4d734c9d8736f3f258422d21f4b1c4f9a50171b6567c194ce"
      },
      "refundPolicy": {
        "version": "2026-09-15-first-party",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
      },
      "privacyDisclosure": {
        "version": "2026-09-15-first-party",
        "path": "/legal/privacy-policy",
        "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
      }
    }
  },
  "sandbox_credits_checkout_bundle": {
    "version": "2026-07-16",
    "path": "/legal/sandbox-credit-terms",
    "documents": {
      "sandboxCreditTerms": {
        "version": "2026-07-16",
        "path": "/legal/sandbox-credit-terms",
        "contentSha256": "0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6"
      },
      "refundPolicy": {
        "version": "2026-07-16",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"
      },
      "privacyDisclosure": {
        "version": "2026-07-16",
        "path": "/legal/privacy-policy",
        "contentSha256": "d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"
      }
    }
  },
  "job_post_fee_checkout_bundle": {
    "version": "2026-09-15-first-party",
    "path": "/legal/job-post-fee-terms",
    "documents": {
      "jobPostFeeTerms": {
        "version": "2026-09-15-first-party",
        "path": "/legal/job-post-fee-terms",
        "contentSha256": "95f83ff1829e2e607823bd0391b7248dacad931b7c42a1f650cbb099a20ce975"
      },
      "refundPolicy": {
        "version": "2026-09-15-first-party",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
      },
      "privacyDisclosure": {
        "version": "2026-09-15-first-party",
        "path": "/legal/privacy-policy",
        "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
      }
    }
  },
  "marketplace_purchase_checkout_bundle": {
    "version": "2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "documents": {
      "marketplaceBuyerTerms": {
        "version": "2026-07-16",
        "path": "/legal/marketplace-commerce-terms",
        "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
      },
      "refundPolicy": {
        "version": "2026-07-16",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"
      },
      "privacyDisclosure": {
        "version": "2026-07-16",
        "path": "/legal/privacy-policy",
        "contentSha256": "d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"
      }
    }
  },
  "marketplace_free_license_bundle": {
    "version": "2026-07-16",
    "path": "/legal/marketplace-commerce-terms",
    "documents": {
      "marketplaceLicenseTerms": {
        "version": "2026-07-16",
        "path": "/legal/marketplace-commerce-terms",
        "contentSha256": "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
      },
      "privacyDisclosure": {
        "version": "2026-07-16",
        "path": "/legal/privacy-policy",
        "contentSha256": "d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"
      }
    }
  },
  "organization_service_checkout_bundle": {
    "version": "2026-09-15-first-party",
    "path": "/legal/organization-services-terms",
    "documents": {
      "organizationServiceTerms": {
        "version": "2026-09-15-first-party",
        "path": "/legal/organization-services-terms",
        "contentSha256": "14762a98e13634e603714f78d0e1e1fc7abf0a13e77661f8df2ea5a3e126a807"
      },
      "refundPolicy": {
        "version": "2026-09-15-first-party",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
      },
      "privacyDisclosure": {
        "version": "2026-09-15-first-party",
        "path": "/legal/privacy-policy",
        "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
      }
    }
  },
  "sponsorship_checkout_bundle": {
    "version": "2026-09-15-first-party",
    "path": "/legal/sponsorship-independence-policy",
    "documents": {
      "sponsorshipTerms": {
        "version": "2026-09-15-first-party",
        "path": "/legal/sponsorship-independence-policy",
        "contentSha256": "3b912386160729427f09698530fd7ab68d9c69bbf776ecb69c8a504bb9db8433"
      },
      "refundPolicy": {
        "version": "2026-09-15-first-party",
        "path": "/legal/refund-and-cancellation-policy",
        "contentSha256": "489fd9795460346b881f2b6eeacfdc991fecb5637178bb4a08a51bebe9acfd21"
      },
      "privacyDisclosure": {
        "version": "2026-09-15-first-party",
        "path": "/legal/privacy-policy",
        "contentSha256": "a60ca6ff75461c259ab26de1b0295015d0bb1d980b8b594a57190432b4b19da8"
      }
    }
  }
} as const;
