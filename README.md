# alexa-skill-skyplus

> Visit my [GitHub Pages site](https://pete-rai.github.io/) to get in touch or to
see demos of this and much more.

## Overview

A connection between [Amazon Echo](https://en.wikipedia.org/wiki/Amazon_Echo) and [Sky Plus](https://en.wikipedia.org/wiki/Sky%2B) in the UK. Using this project you can create
a new Alexa skill which can respond to a range of requests to control you SkyPlus box. It
does this by posting key sequences directly to the box from the AWS cloud. I'm not going
to go into the details of how this works in the readme. You can read all that for yourself
in the /lambda/index.js file. That is where all the magic is hiding.

### License

This plugin is available under [the MIT license](https://github.com/pete-rai/alexa-skill-skyplus/blob/master/LICENSE). _Please respect the terms of the license._

### Acknowledgments

Some portions of the file lambda/index.js were adapted from [work by dalhundal](https://github.com/dalhundal/sky-remote), my thanks to him/her for that.

### Karmaware

This software is released with the [karmaware](https://pete-rai.github.io/karmaware) tag

### Disclaimer

I've done best efforts testing on my personal Amazon Echo. If you find any problems,
do let me know by raising an issue [here](https://github.com/pete-rai/alexa-skill-skyplus/issues). Better still, create a fix for the problem too and drop in the changes; that way everyone can benefit from it.

**The channel listings, channel genres and tv listing site information were all correct when I uploaded the files - but these change all the time, so you may (will) need to tweak them.**

## Example Usage

To use this code to create your own skills, you will need an Amazon account.
Your normal Amazon retail account will work for this. You will need to log in to both
the [Amazon Developer Site](https://developer.amazon.com/) and the [Amazon AWS Site](https://aws.amazon.com/).

The files in the 'alexa' directory are used to create a new skill in the Developer site. The files in the
'lambda' directory are used to create the connected lambda function on AWS. If you want
to know more details of where to put what, check out my earlier [Alexa Boilerplate](https://github.com/pete-rai/alexa-skill-boilerplate) project.

Here are the types of utterances this code can recognise to and respond to. In each case, the response comes after the channel change. Many more combinations that this are possible using this code.

| Utterance | Response |
| --- | --- |
| Show me wildlife programs | This is 'Tiger Trail' on the Discover Channel. It started 12 minutes ago. |
| ShowMeSome put on a game show | You're watching Family Fortunes on Challenge. It's been on for 22 minutes.  |
| TuneChannel switch over to BBC 1 | Now tuned to 'Eastenders' on BBC 1. It kicked off 14 minutes ago. |

If you get stuck, drop me a mail.

_– [Pete Rai](https://pete-rai.github.io/)_
