# =============================================================================
# ProjectOps360° — Microsoft Project (.mpp) converter image for Vercel Sandbox
# =============================================================================
# Why this exists: .mpp is an undocumented OLE2 binary. The only mature reader
# is MPXJ, which is Java, and Vercel Functions run Node — there is no JVM in the
# application process. Rather than adding a Java service to operate (a new host,
# a new bill, a new thing that can be down), the JVM lives in a Sandbox that is
# created per conversion and destroyed after it.
#
# MPXJ is LGPL: free to use commercially. It is consumed here as an unmodified
# library resolved from Maven Central, which is what the licence expects.
#
# Build and push:
#   docker buildx build --platform linux/amd64 \
#     --output "type=image,name=vcr.vercel.com/project-ops360-s-projects/projectops360/mpp-converter:latest,push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true" \
#     docker/mpp-converter
# =============================================================================

# ── Build stage: resolve MPXJ and compile the converter ──────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build

ARG MPXJ_VERSION=16.5.0
WORKDIR /build

# A throwaway POM is the cheapest correct way to pull MPXJ *and its transitive
# dependencies* (POI for the OLE2 container, JAXB, commons). Hand-listing jars
# is how a build silently loses a reader when the library reorganises.
RUN printf '%s\n' \
  '<project xmlns="http://maven.apache.org/POM/4.0.0">' \
  '  <modelVersion>4.0.0</modelVersion>' \
  '  <groupId>com.projectops360</groupId>' \
  '  <artifactId>mpp-converter</artifactId>' \
  '  <version>1.0</version>' \
  '  <properties><maven.compiler.release>21</maven.compiler.release></properties>' \
  '  <dependencies>' \
  '    <dependency>' \
  '      <groupId>net.sf.mpxj</groupId>' \
  '      <artifactId>mpxj</artifactId>' \
  "      <version>${MPXJ_VERSION}</version>" \
  '    </dependency>' \
  '  </dependencies>' \
  '</project>' > pom.xml

# sqlite-jdbc (~14 MB) only serves MPXJ's Primavera/Asta *database* readers,
# which a .mpp conversion never reaches. Excluding it is the single biggest
# size win in the image.
RUN mvn -q -B dependency:copy-dependencies \
      -DoutputDirectory=/opt/mpxj \
      -DexcludeArtifactIds=sqlite-jdbc \
 && mvn -q -B dependency:copy \
      -Dartifact=net.sf.mpxj:mpxj:${MPXJ_VERSION} \
      -DoutputDirectory=/opt/mpxj

COPY Convert.java /build/Convert.java
RUN javac -cp "/opt/mpxj/*" -d /opt/app /build/Convert.java

# ── Runtime stage: JRE only, no Maven, no compiler ───────────────────────────
FROM eclipse-temurin:21-jre-alpine

COPY --from=build /opt/mpxj /opt/mpxj
COPY --from=build /opt/app /opt/app

# Headless and quiet: the sandbox has no display, and MPXJ pulls Log4j in
# transitively but ships no provider — without this every run prints an ERROR
# line to stderr that looks like a failure and is not.
ENV JAVA_TOOL_OPTIONS="-Djava.awt.headless=true -Dlog4j2.loggerContextFactory=org.apache.logging.log4j.simple.SimpleLoggerContextFactory"

WORKDIR /work

# Overridden by the caller with the real file names; a bare `docker run` of this
# image should explain itself rather than fail cryptically.
ENTRYPOINT ["java", "-cp", "/opt/mpxj/*:/opt/app", "Convert"]
CMD ["--help"]
