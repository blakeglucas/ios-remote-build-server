<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<br />
<div align="center">

<h1 align="center">iOS Remote Build Server</h1>

  <p align="center">
    Develop on Windows, build on Mac
    <!-- <br />
    <a href="https://github.com/blakeglucas/ios-remote-build-server"><strong>Explore the docs »</strong></a> -->
    <br />
    <a href="https://github.com/blakeglucas/ios-remote-build-server/issues">Report Bug</a>
    ·
    <a href="https://github.com/blakeglucas/ios-remote-build-server/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

iOS Remote Build Server does exactly what the name suggests: it allows you to build iOS applications remotely, then sends back the .ipa and associated files, similar to Jenkins. However, instead of simply building Release apps, it also allows you to sync your workspace with a remote one, allowing you to develop on an iOS device without losing hot-reloading.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- A Mac computer capable of accepting internet connections and running the latest version of XCode
- NodeJS 16+ installed on said Mac computer
- Yarn install and executable on said Mac computer
- (For now) VSCode with the [vscode-ios-remote-build](https://github.com/blakeglucas/vscode-ios-remote-build) extension installed

### Installation

Install the server using the following command:

- `npm i -g ios-remote-build-server`

Additionally, you can run the server using `npx` instead.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

Run the server with the following command:

`ios-remote-build-server` or `npx ios-remote-build-server`

The server accepts the following arguments:

- `-p, --port <port>`

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [ ] Improve logging and stability
- [ ] Create non-VSCode client

See the [open issues](https://github.com/blakeglucas/ios-remote-build-server/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the MIT License. See the `LICENSE` file for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/blakeglucas/ios-remote-build-server.svg?style=for-the-badge
[contributors-url]: https://github.com/blakeglucas/ios-remote-build-server/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/blakeglucas/ios-remote-build-server.svg?style=for-the-badge
[forks-url]: https://github.com/blakeglucas/ios-remote-build-server/network/members
[stars-shield]: https://img.shields.io/github/stars/blakeglucas/ios-remote-build-server.svg?style=for-the-badge
[stars-url]: https://github.com/blakeglucas/ios-remote-build-server/stargazers
[issues-shield]: https://img.shields.io/github/issues/blakeglucas/ios-remote-build-server.svg?style=for-the-badge
[issues-url]: https://github.com/blakeglucas/ios-remote-build-server/issues
[license-shield]: https://img.shields.io/github/license/blakeglucas/ios-remote-build-server.svg?style=for-the-badge
[license-url]: https://github.com/blakeglucas/ios-remote-build-server/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/blake-lucas-56b01a16a/
