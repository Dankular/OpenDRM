from setuptools import setup, find_packages

setup(
    name="opendrm",
    version="0.1.0",
    description="OpenDRM Python SDK - DRM License Server Client",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="OpenDRM",
    url="https://github.com/TheKhosa/OpenDRM",
    packages=find_packages(),
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
