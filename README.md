# Resume Charon

## Introduction and problem statement

The problem that employers face when hiring is there are too many candidates, and in todays world too many unqualified candidates that need to be sifted through. This is because the cost of applying to a job is zero, and so from a (potential) employee's perspective there is no downside to applying for any and all jobs that he or she is remotely qualified for. This leads to an onerous experience for both the employer and employee; the employer must triage hundreds of canidates, many of which are knowingly unqualified for the position, while the job seeker is incentivized to harness AI and other mechanized systems for applying to as many positions as possible.

## The Solution

Most solutions to this problem will join the arms race and use AI to automate the process of filtering candidates. This will just lead to AI talking to itself.

I propose attaching a price to the job application. The cost of an application to a job is nominal/optional, borne by the applicant, and kept by the application middleware: charon. This system provides the following incentives:

1. Job seekers will be incentivized to apply for jobs that they are actually qualified for, reducing the number of unqualified candidates that need to be sifted through.
2. Employers have a self-reported guage of a job seekers fit for the role.
3. Job seekers save time and effort by not getting drowned out by a flood of unqualified candidates.
4. Employers still have to pay for a job posting and do not recieve any of the "obols" so that there is no conflict of interest.

## Core ideas

The implementation of this idea is simple:

1. Employers can log into the system and create job postings.
   * Each job posting has a fixed fee for a duration (stripe integrated for payment)
   * The employer can log into their account and get a list of applicants per job. An "applicant" is simply a resume and the amount of obols bid ($1, $3, or $5).
2. Job seekers can log into the system and apply for jobs. The jobs can be either linked to directly or a simple search interface is provided which will search through all the employer-posted job listings.
   * An application is simply a resume, some basic information (can be retrieved from the account), and an "obol".
   * An obol is $0, $1, $3, or $5.
3. Both employees and employers can see an anomyized view of the metrics for each job posting, these metrics are:
   * How many people have applied
   * The distribution of obol amount attached to each application
   * The line graph showing rate of application (applications over time)

## Implementation

The site is built using the following technologies:

1. Frontend: React.js
2. Backend: Django
3. Database: sqlite3 (async, ready for switch to postgresql later)
4. Authentication: JWT (JSON Web Tokens)
5. Payment: Stripe API

For simplicity everything is on the same server.
